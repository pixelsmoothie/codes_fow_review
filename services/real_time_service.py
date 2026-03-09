from flask import request
from flask_socketio import emit, join_room, leave_room, disconnect
import jwt
import os
from datetime import datetime
from db import get_db

JWT_SECRET = os.getenv("JWT_SECRET", "stego-vault-dev-secret-key-1337!!")
JWT_ALGORITHM = "HS256"

# We'll initialize socketio in app.py and pass it here if needed, 
# or just define handlers that app.py imports.

def init_socket_handlers(socketio):
    @socketio.on('connect')
    def handle_connect(auth):
        """
        Handle socket connection with JWT authentication.
        The client sends { token: '...' } in the auth payload.
        Falls back to query string ?token=... for older clients.
        """
        # Try auth dict first, then query string fallback
        token = None
        if auth and isinstance(auth, dict):
            token = auth.get('token')
        if not token:
            token = request.args.get('token')

        if not token:
            print("[Socket] Connection rejected: Missing token")
            disconnect()
            return False

        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            client_id = data.get("user_id")
            if not client_id:
                print("[Socket] Connection rejected: Token missing user_id")
                disconnect()
                return False

            db = get_db()
            user = db.users.find_one({"client_id": client_id})
            if not user:
                print(f"[Socket] Connection rejected: User {client_id} not found")
                disconnect()
                return False

            # Join room named after client_id so we can target them directly
            join_room(client_id)
            print(f"[Socket] User {client_id} connected and joined room '{client_id}'")

            # Update last seen
            db.users.update_one({"client_id": client_id}, {"$set": {"last_seen": datetime.utcnow()}})

            # Emit confirmation back to this client
            emit('connected', {'status': 'ok', 'client_id': client_id})

        except jwt.ExpiredSignatureError:
            print("[Socket] Connection rejected: Token expired")
            disconnect()
            return False
        except Exception as e:
            print(f"[Socket] Connection rejected: {str(e)}")
            disconnect()
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        print("[Socket] Client disconnected")

    @socketio.on('join_chat')
    def on_join(data):
        """Allow client to explicitly re-join their room (e.g. after reconnect)."""
        client_id = data.get('client_id')
        if client_id:
            join_room(client_id)
            print(f"[Socket] User {client_id} re-joined room via join_chat")

def notify_user_message(socketio, recipient_id, message_data):
    """
    Server-side helper to emit a real-time message to a specific user's room.
    """
    socketio.emit('new_message', message_data, room=recipient_id)
