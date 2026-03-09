import eventlet
eventlet.monkey_patch()

import os
import sys
from flask import Flask, send_from_directory, request, jsonify

from services.ml_service import init_ml
from extensions import socketio
from services.real_time_service import init_socket_handlers

# Import Blueprints
from routes.chat_routes import chat_bp
from routes.crypto_routes import crypto_bp
from routes.auth_routes import auth_bp
from routes.contact_routes import contact_bp
from routes.stego_routes import stego_bp, UPLOAD_FOLDER
from routes.ml_routes import ml_bp

# Initialize ML Models
init_ml()

app = Flask(__name__, static_folder="web/static", static_url_path="")
app.config['SECRET_KEY'] = os.getenv("JWT_SECRET", "stego_secret_key_2024")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize SocketIO with flask app
socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')
init_socket_handlers(socketio)

# Register Blueprints
app.register_blueprint(chat_bp)
app.register_blueprint(crypto_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(contact_bp)
app.register_blueprint(stego_bp)
app.register_blueprint(ml_bp)

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    from db import check_connection
    if not check_connection():
        print("ERROR: MongoDB is not reachable on localhost:27017.")
        print("Please ensure MongoDB is running before starting the Vault.")
        sys.exit(1)
        
    print("[Server] Starting with SocketIO + eventlet")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)