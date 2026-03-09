from flask import Blueprint, request, jsonify
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from db import get_db
from services.chat_service import generate_unique_id, serialize

auth_bp = Blueprint("auth", __name__)

JWT_SECRET = os.getenv("JWT_SECRET", "stego-vault-dev-secret-key-1337!!")
JWT_ALGORITHM = "HS256"

def create_token(unique_id):
    """Generate a JWT token for a user, expiring in 7 days."""
    payload = {
        "user_id": unique_id, # Now using permanent unique_id
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def token_required(f):
    """Decorator to protect routes with JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            db = get_db()
            # Try searching by unique_id (new tokens) or client_id (old tokens)
            current_user = db.users.find_one({"unique_id": data["user_id"]})
            if not current_user:
                current_user = db.users.find_one({"client_id": data["user_id"]})
            
            if not current_user:
                return jsonify({"error": "Invalid token - user not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except Exception:
            return jsonify({"error": "Token is invalid"}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        client_id = (data.get("client_id") or "").strip() # This is the display name
        
        if not email or not password or not client_id:
            return jsonify({"error": "Email, password, and display name are required"}), 400
            
        db = get_db()
        
        # Check if email exists
        if db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 400
            
        # Overwrite legacy users with same client_id (if they have no email/pass)
        legacy_user = db.users.find_one({"client_id": client_id})
        if legacy_user and not legacy_user.get("email"):
            db.users.delete_one({"_id": legacy_user["_id"]})
        elif legacy_user:
            return jsonify({"error": "Display name already taken"}), 400

        # Hash password
        salt = bcrypt.gensalt()
        pw_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        unique_id = generate_unique_id()
        
        user_doc = {
            "email": email,
            "password_hash": pw_hash, # Binary data is fine in Mongo
            "client_id": client_id,
            "unique_id": unique_id,
            "contacts": [], # Starting empty
            "avatar": data.get("avatar", "ninja"),
            "last_seen": datetime.utcnow()
        }
        
        db.users.insert_one(user_doc)
        
        token = create_token(unique_id)
        
        # Do NOT return password_hash
        response_user = serialize(user_doc.copy())
        if "password_hash" in response_user: del response_user["password_hash"]
        
        return jsonify({
            "status": "ok",
            "token": token,
            "user": response_user
        }), 201
    except Exception:
        return jsonify({"error": "Internal server error during registration"}), 500

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
        
    db = get_db()
    user = db.users.find_one({"email": email})
    
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401
        
    token = create_token(user["unique_id"])
    
    from services.crypto_service import DH_PARAMS
    from services.chat_service import register_user
    from cryptography.hazmat.primitives import serialization as _ser

    # Generate new DH keys for the new session
    dh_priv = DH_PARAMS.generate_private_key()
    dh_pub_pem = dh_priv.public_key().public_bytes(
        _ser.Encoding.PEM,
        _ser.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    
    # Re-register the user to update DH keys in DB and in-memory
    register_user(
        client_id=user["client_id"],
        port=user.get("port", 0),  
        avatar=user.get("avatar", "ninja"),
        avatar_data=user.get("avatar_data", ""),
        dh_public_key_pem=dh_pub_pem,
        dh_private_key_obj=dh_priv
    )
    
    # fetch updated user record after register_user overwrote the DH key
    user = db.users.find_one({"email": email})

    response_user = serialize(user.copy())
    if "password_hash" in response_user: del response_user["password_hash"]
    
    return jsonify({
        "status": "ok",
        "token": token,
        "user": response_user
    })

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    # Since JWT is stateless, we just acknowledge. 
    # Client will discard the token.
    return jsonify({"status": "ok"})