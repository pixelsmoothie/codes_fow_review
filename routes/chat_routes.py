from flask import Blueprint, request, jsonify
from services.crypto_service import DH_PARAMS_PEM
from services.chat_service import get_registry, get_sessions, now_iso, append_chat_log, append_session_msg, session_key, get_shared_secret
from services.stego_service import build_chat_packet
from services.ml_service import get_traffic_capture
from services.chatbot_service import chatbot
from cryptography.hazmat.primitives import serialization
from routes.auth_routes import token_required
from db import get_db
from concurrent.futures import ThreadPoolExecutor

chat_bp = Blueprint("chat", __name__)

# Thread pool for CPU-heavy crypto/stego work — keeps Flask workers unblocked
# during DH key derivation, AES encryption, and LSB/DCT image processing.
_packet_executor = ThreadPoolExecutor(max_workers=4)

@chat_bp.route("/api/auth/me", methods=["GET"])
@token_required
def api_me(current_user):
    """Return the current authenticated user's profile. Used for session restore."""
    from services.chat_service import serialize
    u = serialize(current_user.copy())
    if "password_hash" in u:
        del u["password_hash"]
    return jsonify({"status": "ok", "user": u})


@chat_bp.route("/api/chat/bot", methods=["POST"])
@token_required
def api_chat_bot(current_user):
    """Dedicated chatbot endpoint — avoids mutual-contact check."""
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    sender = current_user["client_id"]
    bot_response = chatbot.get_response(message, sender)

    db = get_db()
    ts = now_iso()
    BOT_ID = "System Assistant"

    db.messages.insert_one({"timestamp": ts, "direction": "sent", "from": sender, "to": BOT_ID, "plaintext": message, "mode": "aes"})
    db.messages.insert_one({"timestamp": now_iso(), "direction": "received", "from": BOT_ID, "to": sender, "plaintext": bot_response, "mode": "aes"})

    from extensions import socketio
    from services.real_time_service import notify_user_message
    notify_user_message(socketio, sender, {"status": "new_message", "from": BOT_ID, "message_preview": bot_response[:100]})

    return jsonify({"status": "ok", "bot_response": bot_response, "timestamp": ts})



@chat_bp.route("/api/chat/online", methods=["GET"])
@token_required
def api_chat_online(current_user):
    from services.chat_service import get_online_users, update_last_seen, serialize
    from datetime import datetime, timedelta
    
    client_id = current_user["client_id"]
    update_last_seen(client_id)
    
    db = get_db()
    contact_uids = current_user.get("contacts", [])
    
    # We want to return ALL contacts, with their online status
    cutoff = datetime.utcnow() - timedelta(seconds=30)
    
    online_ids = []
    avatars = {}
    unique_ids_map = {}
    contact_statuses = {} # client_id -> bool (online)
    all_contacts = []

    for uuid in contact_uids:
        # The contacts array stores client_ids, not unique_ids (legacy naming in local var uuid)
        u = db.users.find_one({"client_id": uuid})
        if not u:
            # Fallback for older records that might have used unique_id
            u = db.users.find_one({"unique_id": uuid})
        if u:
            is_online = bool(u.get("last_seen") and u["last_seen"] > cutoff)
            entry = {
                "client_id": u["client_id"],
                "unique_id": u.get("unique_id"),
                "avatar": u.get("avatar", "ninja"),
                "online": is_online
            }
            all_contacts.append(entry)
            if is_online:
                online_ids.append(u["client_id"])
            avatars[u["client_id"]] = u.get("avatar", "ninja")
            unique_ids_map[u["client_id"]] = u.get("unique_id")
            contact_statuses[u["client_id"]] = is_online

    # Inject System Assistant as a permanent contact
    all_contacts.insert(0, {
        "client_id": "System Assistant",
        "unique_id": "BOT-001",
        "avatar": "phoenix",
        "online": True
    })
    contact_statuses["System Assistant"] = True
    avatars["System Assistant"] = "phoenix"
    unique_ids_map["System Assistant"] = "BOT-001"

    return jsonify({
        "status": "ok",
        "contacts": all_contacts, # New structured list
        "online": online_ids,     # Deprecated but kept for safety
        "avatars": avatars,        # Deprecated but kept for safety
        "unique_ids": unique_ids_map, # New convenience map
        "contact_statuses": contact_statuses
    })


@chat_bp.route("/api/chat/send", methods=["POST"])
@token_required
def api_chat_send(current_user):
    data = request.get_json() or {}
    sender = (data.get("from_id") or "").strip()
    recipient = (data.get("to_id") or "").strip()
    
    # Verify sender is the authorized user
    if sender != current_user["client_id"]:
        return jsonify({"error": "Unauthorized: sender must match token user"}), 403
    mode = (data.get("mode") or "aes").strip().lower()
    message = (data.get("message") or "").strip()
    algorithm = (data.get("algorithm") or "lsb").strip().lower()
    custom_image_b64 = data.get("custom_image_b64")
    multimedia_b64 = data.get("multimedia_b64")
    filename = data.get("filename")

    if not sender or not recipient:
        return jsonify({"error": "from_id and to_id are required"}), 400
    if not message and not multimedia_b64:
        return jsonify({"error": "message is required"}), 400
    if mode not in ("aes", "stego", "both"):
        return jsonify({"error": "mode must be aes, stego, or both"}), 400
    
    db = get_db()
    
    if not db.users.find_one({"client_id": sender}):
        return jsonify({"error": f"sender '{sender}' is not registered"}), 400

    BOT_ID = "System Assistant"
    if recipient == BOT_ID:
        # Handle chatbot interaction
        ts = now_iso()
        bot_response = chatbot.get_response(message, sender)
        
        # Save user message to bot
        user_msg = {
            "timestamp": ts, "direction": "sent", "from": sender, "to": BOT_ID,
            "plaintext": message, "mode": "aes"
        }
        db.messages.insert_one(user_msg)
        
        # Save bot response
        bot_msg = {
            "timestamp": now_iso(), "direction": "received", "from": BOT_ID, "to": sender,
            "plaintext": bot_response, "mode": "aes"
        }
        db.messages.insert_one(bot_msg)
        
        # Notify user via WebSockets immediately
        from extensions import socketio
        from services.real_time_service import notify_user_message
        notify_user_message(socketio, sender, {
            "status": "new_message",
            "from": BOT_ID,
            "message_preview": bot_response[:100]
        })
        
        return jsonify({"status": "ok", "bot_response": bot_response, "timestamp": ts})

    # Resolve recipient by client_id first, then unique_id (handles rename case)
    recipient_record = db.users.find_one({"client_id": recipient})
    if not recipient_record:
        recipient_record = db.users.find_one({"unique_id": recipient})
    if not recipient_record:
        return jsonify({"error": f"recipient '{recipient}' is not registered"}), 400
        
    # Normalize to current client_id in case frontend sent stale name
    recipient = recipient_record["client_id"]

    from services.chat_service import get_shared_secret, update_last_seen, is_mutual_contact
    
    # EXPLICIT RULE: Mutual contacts required for messaging
    if not is_mutual_contact(sender, recipient):
        return jsonify({"error": "Messaging blocked: Mutual contact required"}), 403
    try:
        from services.stego_service import build_chat_packet
        future = _packet_executor.submit(
            build_chat_packet,
            mode, message, sender, recipient,
            get_shared_secret, custom_image_b64, multimedia_b64, algorithm,
            filename=filename
        )
        packet = future.result(timeout=60)
    except Exception as e:
        return jsonify({"error": f"Failed to build packet: {str(e)}"}), 400

    # Fetch unique IDs for session persistence and history matching
    ts = now_iso()
    sender_uid = current_user.get("unique_id")
    recipient_record = db.users.find_one({"client_id": recipient})
    recipient_uid = recipient_record.get("unique_id") if recipient_record else None

    send_entry = {
        "timestamp": ts, 
        "direction": "sent", 
        "from": sender, 
        "to": recipient,
        "from_uid": sender_uid,
        "to_uid": recipient_uid,
        **packet
    }
    recv_entry = {
        "timestamp": ts, 
        "direction": "received", 
        "from": sender, 
        "to": recipient,
        "from_uid": sender_uid,
        "to_uid": recipient_uid,
        **packet
    }

    # Persist both directions so each party's poll sees their copy.
    # send_entry  → queried by sender   (direction="sent")
    # recv_entry  → queried by recipient (direction="received")
    db.messages.insert_one(send_entry)
    db.messages.insert_one(recv_entry)

    # We still want to keep track of who talked to whom for the contact list order/existence,
    # but we don't store the messages inside the session document anymore.
    sessions = db.sessions
    for viewer, other, viewer_uid, other_uid in [
        (sender, recipient, sender_uid, recipient_uid),
        (recipient, sender, recipient_uid, sender_uid)
    ]:
        key = session_key(viewer, other)
        sessions.update_one(
            {"session_id": key},
            {
                "$set": {
                    "viewer_uid": viewer_uid, 
                    "other_uid": other_uid,
                    "last_message_at": ts
                }
            },
            upsert=True
        )
    
    # Update heartbeats
    from services.chat_service import update_last_seen
    update_last_seen(sender)

    # Real-time WebSockets notification
    from extensions import socketio
    from services.real_time_service import notify_user_message
    
    # Notify recipient
    notify_user_message(socketio, recipient, {
        "status": "new_message",
        "from": sender,
        "timestamp": ts,
        "message_preview": message[:100] + ("..." if len(message) > 100 else "")
    })

    traffic = get_traffic_capture()
    if traffic:
        msg_len = len(message.encode("utf-8"))
        traffic.add_packet("127.0.0.1", "127.0.0.1", 5000, 5000, "TCP", msg_len)

    return jsonify({"status": "ok", "packet": packet, "timestamp": ts})


@chat_bp.route("/api/chat/message/<message_id>", methods=["GET"])
@token_required
def api_chat_message(current_user, message_id):
    """Fetch a single full message including multimedia_b64, for on-demand media loading."""
    from services.chat_service import serialize
    from bson import ObjectId
    db = get_db()
    try:
        doc = db.messages.find_one({"_id": ObjectId(message_id)})
    except Exception:
        return jsonify({"error": "Invalid message id"}), 400
    if not doc:
        return jsonify({"error": "Message not found"}), 404
    # Security: only parties to the message may fetch it
    client_id = current_user["client_id"]
    if doc.get("from") != client_id and doc.get("to") != client_id:
        return jsonify({"error": "Forbidden"}), 403
    m = serialize(doc)
    m["direction"] = "sent" if m.get("from") == client_id else "received"
    return jsonify({"message": m})


@chat_bp.route("/api/chat/logs", methods=["GET"])
def api_chat_logs():
    client_id = (request.args.get("client_id") or "").strip()
    with_user = (request.args.get("with_user") or "").strip()
    # preview=1 strips multimedia_b64 blobs — used by the polling loop to avoid
    # re-sending megabytes of media on every 2.5-second tick.
    preview = request.args.get("preview") == "1"
    if not client_id:
        return jsonify({"error": "client_id is required"}), 400

    from services.chat_service import serialize
    db = get_db()

    def strip_media(m):
        """Remove the heavy blob but keep a flag so the frontend can show a load button."""
        if preview and m.get("multimedia_b64"):
            m["has_media"] = True
            m["multimedia_b64"] = None
            del m["multimedia_b64"]
        return m

    # Fetch unique IDs for better matching (rename resilience)
    u1 = db.users.find_one({"client_id": client_id})
    uid1 = u1.get("unique_id") if u1 else None

    if with_user:
        u2 = db.users.find_one({"client_id": with_user})
        uid2 = u2.get("unique_id") if u2 else None

        q = {
            "$or": [
                {"from": client_id, "to": with_user},
                {"from": with_user, "to": client_id}
            ]
        }
        if uid1 and uid2:
            q["$or"].extend([
                {"from_uid": uid1, "to_uid": uid2},
                {"from": uid1, "to": uid2},
                {"from": uid2, "to": uid1}
            ])

        cursor = db.messages.find(q).sort("timestamp", 1)
        final = []
        seen = set()
        for doc in cursor:
            m = serialize(doc)
            m["direction"] = "sent" if m.get("from") == client_id else "received"
            dk = f"{m.get('timestamp')}|{m.get('from')}|{m.get('to')}"
            if dk not in seen:
                seen.add(dk)
                final.append(strip_media(m))

        return jsonify({"logs": final})

    # Global logs for 'See Logs' (without specific user)
    q_global = {"$or": [{"from": client_id}, {"to": client_id}]}
    if uid1:
        q_global["$or"].extend([{"from_uid": uid1}, {"to_uid": uid1}])

    cursor = db.messages.find(q_global).sort("timestamp", 1)
    all_msgs = []
    for doc in cursor:
        m = serialize(doc)
        m["direction"] = "sent" if m.get("from") == client_id else "received"
        all_msgs.append(strip_media(m))

    return jsonify({"logs": all_msgs})

@chat_bp.route("/api/user/info/<identifier>", methods=["GET"])
@token_required
def api_user_info(current_user, identifier):
    """Fetch public profile data for a user."""
    db = get_db()
    user = db.users.find_one({"client_id": identifier})
    if not user:
        user = db.users.find_one({"unique_id": identifier})
    if not user:
        return jsonify({"error": "User not found"}), 404
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(seconds=30)
    is_online = bool(user.get("last_seen") and user["last_seen"] > cutoff)
    return jsonify({
        "status": "ok",
        "user": {
            "client_id": user["client_id"],
            "unique_id": user.get("unique_id"),
            "avatar": user.get("avatar", "ninja"),
            "about": user.get("about", ""),
            "online": is_online
        }
    })

@chat_bp.route("/api/user/profile", methods=["PATCH", "PUT"])
@token_required
def update_profile(current_user):
    """Update the current user's profile fields."""
    data = request.get_json() or {}
    allowed = {"display_name", "avatar", "about_me", "client_id", "about"}
    updates = {k: v for k, v in data.items() if k in allowed}
    
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
        
    db = get_db()
    
    # Check name availability if client_id is changing
    new_cid = updates.get("client_id")
    if new_cid and new_cid != current_user["client_id"]:
        if db.users.find_one({"client_id": new_cid}):
            return jsonify({"error": "Display name already taken"}), 400

    db.users.update_one(
        {"unique_id": current_user["unique_id"]},
        {"$set": updates}
    )

    # Broadcast update to all users via WebSockets
    try:
        from extensions import socketio
        socketio.emit("profile_update", {
            "client_id": updates.get("client_id", current_user["client_id"]),
            "display_name": updates.get("display_name"),
            "avatar": updates.get("avatar"),
            "old_client_id": current_user["client_id"] if "client_id" in updates else None
        })
    except Exception:
        pass

    return jsonify({"status": "ok", "message": "Profile updated", "updates": updates})