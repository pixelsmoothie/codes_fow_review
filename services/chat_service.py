from datetime import datetime
from cryptography.hazmat.primitives import serialization
from services.crypto_service import derive_aes_key_from_shared_secret
from db import get_db
from bson import ObjectId
import string
import random

# DH keys MUST stay in memory for security and technical reasons (non-serializable)
# client_id -> cryptography private key object
_DH_KEYS = {}

def serialize(doc):
    """
    Helper to convert BSON types (ObjectId, datetime, bytes) to JSON-serializable formats.
    """
    if not doc:
        return doc
    
    # Work on a copy if it's a dict to avoid polluting the original DB object
    res = doc.copy() if isinstance(doc, dict) else doc
    
    if isinstance(res, dict):
        for k, v in res.items():
            if isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, datetime):
                res[k] = v.isoformat() + "Z"
            elif isinstance(v, bytes):
                # Password hashes should be stripped anyway, but for other binary:
                res[k] = v.hex()
            elif isinstance(v, list):
                res[k] = [serialize(item) for item in v]
            elif isinstance(v, dict):
                res[k] = serialize(v)
    return res

def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def session_key(viewer: str, other: str) -> str:
    return viewer + ":" + other

def generate_unique_id(length=5) -> str:
    """Generate a short alphanumeric unique ID for friend codes."""
    import string
    import random
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=length))
        # Ensure it's unique in the DB
        if not get_db().users.find_one({"unique_id": code}):
            return code

def get_user_by_unique_id(uid):
    """Helper to fetch a user by their permanent Friend Code."""
    return get_db().users.find_one({"unique_id": uid})

def is_mutual_contact(user_a_client_id: str, user_b_client_id: str) -> bool:
    """Check if two users have added each other. Contacts are stored as client_ids."""
    db = get_db()
    u_a = db.users.find_one({"client_id": user_a_client_id})
    u_b = db.users.find_one({"client_id": user_b_client_id})
    if not u_a or not u_b:
        return False

    contacts_a = u_a.get("contacts", [])
    contacts_b = u_b.get("contacts", [])

    return (user_b_client_id in contacts_a) and (user_a_client_id in contacts_b)

def append_chat_log(client_id: str, entry: dict) -> None:
    """
    Append a log entry to the user's persistent log history.
    """
    users = get_db()["users"]
    users.update_one(
        {"client_id": client_id},
        {"$push": {"logs": entry}},
        upsert=True
    )

def append_session_msg(viewer: str, other: str, entry: dict) -> None:
    """
    Persist a message in a specific conversation session.
    """
    sessions = get_db()["sessions"]
    key = session_key(viewer, other)
    sessions.update_one(
        {"session_id": key},
        {"$push": {"messages": entry}},
        upsert=True
    )

def get_shared_secret(sender_id: str, recipient_id: str) -> tuple:
    """
    Derive the DH shared secret using in-memory keys and remote public keys.
    """
    from cryptography.hazmat.primitives import serialization
    
    db = get_db()
    sender_record = db.users.find_one({"client_id": sender_id})
    recipient_record = db.users.find_one({"client_id": recipient_id})

    if not sender_id in _DH_KEYS:
        # Transparently regenerate DH keys if server memory was wiped (restart)
        from services.crypto_service import DH_PARAMS
        dh_priv = DH_PARAMS.generate_private_key()
        dh_pub_pem = dh_priv.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")
        
        _DH_KEYS[sender_id] = dh_priv
        db.users.update_one({"client_id": sender_id}, {"$set": {"dh_public_key_pem": dh_pub_pem}})
        sender_record["dh_public_key_pem"] = dh_pub_pem
    if not recipient_record:
        raise ValueError(f"Recipient '{recipient_id}' not found in DB")
    if not recipient_record.get("dh_public_key_pem"):
        # Recipient has no public key — they registered before the DH login fix,
        # or their record is stale. Generate a placeholder public key for them.
        # Their private key will be regenerated via the sender-side fallback
        # the next time THEY send a message. This unblocks the current sender.
        from services.crypto_service import DH_PARAMS
        from cryptography.hazmat.primitives import serialization as _ser
        _tmp_priv = DH_PARAMS.generate_private_key()
        _tmp_pub_pem = _tmp_priv.public_key().public_bytes(
            _ser.Encoding.PEM, _ser.PublicFormat.SubjectPublicKeyInfo
        ).decode("utf-8")
        # Store both the public key in DB and private key in memory
        _DH_KEYS[recipient_id] = _tmp_priv
        db.users.update_one(
            {"client_id": recipient_id},
            {"$set": {"dh_public_key_pem": _tmp_pub_pem}}
        )
        recipient_record = db.users.find_one({"client_id": recipient_id})

    # Update last_seen for the sender whenever they engage in a secret derivation (active session)
    update_last_seen(sender_id)

    # Load in-memory private key
    sender_priv = _DH_KEYS[sender_id]
    sender_pub  = sender_priv.public_key()
    
    # Load recipient's public key from the DB
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.backends import default_backend
    
    recipient_pub_pem = recipient_record["dh_public_key_pem"]
    recipient_pub = load_pem_public_key(recipient_pub_pem.encode("utf-8"), backend=default_backend())

    shared_secret = sender_priv.exchange(recipient_pub)
    aes_key = derive_aes_key_from_shared_secret(shared_secret)

    debug = {
        "sender_public_key_pem": sender_pub.public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8"),
        "recipient_public_key_pem": recipient_pub_pem,
        "shared_secret_hex": shared_secret.hex(),
        "shared_secret_preview": shared_secret[:16].hex() + "...",
        "aes_key_hex": aes_key.hex(),
        "aes_key_preview": aes_key[:16].hex() + "...",
    }
    return shared_secret, debug

def update_last_seen(client_id: str):
    """Update the heartbeat timestamp for a user."""
    get_db().users.update_one(
        {"client_id": client_id},
        {"$set": {"last_seen": datetime.utcnow()}}
    )

def register_user(client_id: str, port: int, avatar: str, avatar_data: str, dh_public_key_pem: str, dh_private_key_obj):
    """
    Register or update a user's persistent record and store their private DH key in memory.
    """
    db = get_db()
    
    # Store sensitive key in memory ONLY
    if dh_private_key_obj:
        _DH_KEYS[client_id] = dh_private_key_obj
        
    user_data = {
        "client_id": client_id,
        "port": port,
        "avatar": avatar,
        "avatar_data": avatar_data,
        "dh_public_key_pem": dh_public_key_pem,
        "last_seen": datetime.utcnow()
    }
    
    db.users.update_one(
        {"client_id": client_id},
        {"$set": user_data},
        upsert=True
    )
    return user_data

def get_online_users():
    """
    Return users who have been seen in the last 30 seconds.
    """
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(seconds=30)
    cursor = get_db().users.find({"last_seen": {"$gt": cutoff}})
    return [serialize(u) for u in cursor]

def get_registry():
    """Returns a view of all user records."""
    return {u["client_id"]: serialize(u) for u in get_db().users.find()}

def get_sessions():
    """Returns a view of all session records."""
    return {s["session_id"]: s["messages"] for s in get_db().sessions.find()}