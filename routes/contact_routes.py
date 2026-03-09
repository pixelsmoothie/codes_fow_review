from flask import Blueprint, request, jsonify
from db import get_db
from routes.auth_routes import token_required
from services.chat_service import serialize, now_iso
from datetime import datetime, timedelta

contact_bp = Blueprint("contacts", __name__)


def _get_request(db, from_id, to_id):
    return db.contact_requests.find_one({
        "from_id": from_id, "to_id": to_id, "status": "pending"
    })


@contact_bp.route("/api/contacts/add", methods=["POST"])
@token_required
def add_contact(current_user):
    data = request.get_json() or {}
    target_unique_id = (data.get("unique_id") or "").strip().upper()
    if not target_unique_id:
        return jsonify({"error": "Friend code (unique_id) is required"}), 400

    db = get_db()
    target_user = db.users.find_one({"unique_id": target_unique_id})
    if not target_user:
        return jsonify({"error": "User with this friend code not found"}), 404

    me = current_user["client_id"]
    them = target_user["client_id"]

    if them == me:
        return jsonify({"error": "You cannot add yourself"}), 400

    # Block check
    if me in target_user.get("blocked", []):
        return jsonify({"error": "User not found"}), 404

    # Already contacts
    if them in current_user.get("contacts", []):
        return jsonify({"status": "already_contacts"}), 200

    # If a pending request already exists, delete it and re-create (idempotent resend)
    db.contact_requests.delete_one({"from_id": me, "to_id": them, "status": "pending"})

    # Create request
    db.contact_requests.insert_one({
        "from_id": me, "to_id": them,
        "status": "pending", "created_at": datetime.utcnow()
    })
    return jsonify({"status": "request_sent", "message": "Request sent! Awaiting approval."}), 200


@contact_bp.route("/api/contacts/respond", methods=["POST"])
@token_required
def respond_to_request(current_user):
    data = request.get_json() or {}
    from_id = (data.get("from_id") or "").strip()
    action  = (data.get("action") or "").strip()  # accept | reject | block

    if not from_id or action not in ("accept", "reject", "block"):
        return jsonify({"error": "from_id and action required"}), 400

    db = get_db()
    me = current_user["client_id"]
    req = _get_request(db, from_id, me)
    if not req:
        return jsonify({"error": "No pending request from that user"}), 404

    if action == "accept":
        db.contact_requests.update_one({"_id": req["_id"]},
            {"$set": {"status": "accepted", "resolved_at": datetime.utcnow()}})
        db.users.update_one({"client_id": me},      {"$addToSet": {"contacts": from_id}})
        db.users.update_one({"client_id": from_id}, {"$addToSet": {"contacts": me}})
        return jsonify({"status": "ok", "action": "accepted"})

    elif action == "reject":
        db.contact_requests.update_one({"_id": req["_id"]},
            {"$set": {"status": "rejected", "resolved_at": datetime.utcnow()}})
        return jsonify({"status": "ok", "action": "rejected"})

    elif action == "block":
        db.contact_requests.update_one({"_id": req["_id"]},
            {"$set": {"status": "blocked", "resolved_at": datetime.utcnow()}})
        db.users.update_one({"client_id": me}, {"$addToSet": {"blocked": from_id}})
        return jsonify({"status": "ok", "action": "blocked"})


@contact_bp.route("/api/contacts/requests/cancel", methods=["POST"])
@token_required
def cancel_request(current_user):
    data = request.get_json() or {}
    to_id = (data.get("to_id") or "").strip()
    if not to_id:
        return jsonify({"error": "to_id is required"}), 400
    db = get_db()
    me = current_user["client_id"]
    result = db.contact_requests.delete_one({"from_id": me, "to_id": to_id, "status": "pending"})
    if result.deleted_count:
        return jsonify({"status": "ok", "message": "Request cancelled."})
    return jsonify({"error": "No pending request found."}), 404


@contact_bp.route("/api/contacts/requests/incoming", methods=["GET"])
@token_required
def incoming_requests(current_user):
    db = get_db()
    me = current_user["client_id"]
    reqs = list(db.contact_requests.find({"to_id": me, "status": "pending"}))
    result = []
    for r in reqs:
        sender = db.users.find_one({"client_id": r["from_id"]})
        result.append({
            "from_id": r["from_id"],
            "avatar": sender.get("avatar", "ninja") if sender else "ninja",
            "created_at": r["created_at"].isoformat() + "Z" if r.get("created_at") else ""
        })
    return jsonify({"status": "ok", "requests": result})


@contact_bp.route("/api/contacts/requests/outgoing", methods=["GET"])
@token_required
def outgoing_requests(current_user):
    db = get_db()
    me = current_user["client_id"]
    cutoff = datetime.utcnow() - timedelta(minutes=2)
    reqs = list(db.contact_requests.find({
        "from_id": me,
        "status": {"$in": ["accepted", "rejected", "blocked"]},
        "resolved_at": {"$gt": cutoff}
    }))
    return jsonify({"status": "ok", "requests": [
        {"to_id": r["to_id"], "status": r["status"]} for r in reqs
    ]})


@contact_bp.route("/api/contacts/list", methods=["GET"])
@token_required
def list_contacts(current_user):
    db = get_db()
    contact_ids = current_user.get("contacts", [])
    cutoff = datetime.utcnow() - timedelta(seconds=30)
    contacts_data = []
    for cid in contact_ids:
        u = db.users.find_one({"client_id": cid})
        if u:
            is_online = u.get("last_seen") and u["last_seen"] > cutoff
            contacts_data.append({
                "client_id": u["client_id"],
                "avatar": u.get("avatar", "ninja"),
                "avatar_data": u.get("avatar_data"),
                "online": bool(is_online),
                "unique_id": u.get("unique_id")
            })
    return jsonify({"status": "ok", "contacts": contacts_data})


@contact_bp.route("/api/contacts/remove", methods=["DELETE"])
@token_required
def remove_contact(current_user):
    data = request.get_json() or {}
    target_client_id = (data.get("target_client_id") or "").strip()
    if not target_client_id:
        return jsonify({"error": "target_client_id is required"}), 400
    get_db().users.update_one(
        {"client_id": current_user["client_id"]},
        {"$pull": {"contacts": target_client_id}}
    )
    return jsonify({"status": "ok"})