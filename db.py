from pymongo import MongoClient
import os

# MongoDB connection string
# Defaulting to localhost:27017
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = MongoClient(MONGO_URI)
db = client["secure_chat"]

def get_db():
    """
    Returns the 'secure_chat' database instance.
    """
    return db

def get_collection(name):
    """
    Returns a specific collection from the database.
    """
    return db[name]

def check_connection():
    """
    Simple health check to verify MongoDB is reachable.
    """
    try:
        # The admin command 'ping' is a standard way to check connectivity
        client.admin.command('ping')
        return True
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        return False
