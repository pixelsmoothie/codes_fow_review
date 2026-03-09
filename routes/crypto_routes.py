from flask import Blueprint, request, jsonify
import base64
from services.crypto_service import DH_PARAMS_PEM
from services.chat_service import get_registry
from crypto.aes import encrypt_message, decrypt_message

crypto_bp = Blueprint("crypto", __name__)

@crypto_bp.route("/api/dh/params", methods=["GET"])
def api_dh_params():
    return jsonify({"dh_params_pem": DH_PARAMS_PEM.decode("utf-8")})

@crypto_bp.route("/api/dh/pubkey/<client_id>", methods=["GET"])
def api_dh_get_pubkey(client_id):
    record = get_registry().get(client_id)
    if not record or not record.get("dh_public_key_pem"):
        return jsonify({"error": f"No public key found for '{client_id}'"}), 404
    return jsonify({"client_id": client_id, "dh_public_key_pem": record["dh_public_key_pem"]})

@crypto_bp.route("/api/aes/encrypt", methods=["POST"])
def api_aes_encrypt():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    password = data.get("password", "default-analyze-password")
    if not message:
        return jsonify({"error": "message is required"}), 400
    try:
        ct = encrypt_message(message, password)
        return jsonify({"cipher_b64": base64.b64encode(ct).decode("ascii"), "length": len(ct)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@crypto_bp.route("/api/aes/decrypt", methods=["POST"])
def api_aes_decrypt():
    data = request.get_json() or {}
    cipher_b64 = data.get("cipher_b64", "").strip()
    password = data.get("password", "default-analyze-password")
    if not cipher_b64:
        return jsonify({"error": "cipher_b64 is required"}), 400
    try:
        ct = base64.b64decode(cipher_b64)
        msg = decrypt_message(ct, password)
        return jsonify({"message": msg})
    except Exception as e:
        return jsonify({"error": str(e)}), 400