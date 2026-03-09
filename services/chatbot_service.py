import time
import threading
from collections import defaultdict

# Cache for rate limiting: {user_id: [timestamps]}
_rate_limits = defaultdict(list)
_rate_limit_lock = threading.Lock()

# System Knowledge Base
SYSTEM_KNOWLEDGE = {
    "architecture": "The system is built with a Flask backend, MongoDB for persistence, and Socket.IO for real-time communication. The frontend is a modern SPA using Vanilla JS.",
    "security": "We implement end-to-end encryption for chat messages using AES-256 for symmetric encryption and RSA for key exchange. JWT is used for session management.",
    "ml": "The system features a Network Traffic Analyzer (Anomalous Traffic Detection) and an ELA (Error Level Analysis) SVM model for image tampering detection.",
    "steganography": "Currently supported methods include LSB (Least Significant Bit) and DCT (Discrete Cosine Transform) for hiding data in images.",
    "networking": "The application uses WebSockets (Socket.IO) for low-latency message delivery and real-time status updates.",
    "pcap": "PCAP (Packet Capture) files can be uploaded to analyze network traffic patterns and detect potential exfiltration or attacks."
}

class ChatbotService:
    def __init__(self, model_name="distilgpt2", use_local=True):
        self.use_local = use_local
        self.model_name = model_name
        self.generator = None
        self.is_loading = False
        
        # Knowledge triggers
        self.knowledge_map = {
            "arch": "architecture", "system": "architecture", "how does this work": "architecture",
            "crypto": "security", "encryption": "security", "safe": "security", "secure": "security", "jwt": "security",
            "model": "ml", "ai": "ml", "machine learning": "ml", "detection": "ml", "ela": "ml",
            "stego": "steganography", "hide": "steganography", "lsb": "steganography", "dct": "steganography",
            "socket": "networking", "websocket": "networking", "realtime": "networking", "poll": "networking",
            "packet": "pcap", "traffic": "pcap", "analyzer": "pcap"
        }

    def _load_model(self):
        """Loads a small local model if needed."""
        if self.generator or self.is_loading:
            return
            
        def load():
            try:
                self.is_loading = True
                print(f"[Chatbot] Loading SLM: {self.model_name}...")
                from transformers import pipeline
                # Use a very small model for CPU efficiency
                self.generator = pipeline("text-generation", model=self.model_name, device=-1)
                print("[Chatbot] SLM loaded successfully")
            except Exception as e:
                print(f"[Chatbot] Failed to load local SLM: {e}")
            finally:
                self.is_loading = False
        
        # Load in background thread to not block service startup
        thread = threading.Thread(target=load)
        thread.daemon = True
        thread.start()

    def check_rate_limit(self, user_id, limit=5, window=60):
        """Simple rate limiting: 5 messages per 60 seconds."""
        now = time.time()
        with _rate_limit_lock:
            timestamps = _rate_limits[user_id]
            # Remove old timestamps
            timestamps = [ts for ts in timestamps if now - ts < window]
            if len(timestamps) >= limit:
                return False
            timestamps.append(now)
            _rate_limits[user_id] = timestamps
            return True

    def get_response(self, query, user_id="anonymous"):
        """Process query and return response."""
        if not self.check_rate_limit(user_id):
            return "Whoa there! I can only handle a few questions at a time. Please wait a minute before asking more."

        query_lower = query.lower()
        
        # 1. Check for specific system knowledge triggers
        for key, topic in self.knowledge_map.items():
            if key in query_lower:
                return f"[System Intel] {SYSTEM_KNOWLEDGE[topic]}"

        # 2. Fallback to conversational SLM or static responses
        # If we want to use local LLM, we trigger lazy loading here
        # For now, let's provide a robust static fallback to avoid OOM on small servers
        # but keep the structure for LLM ready.
        
        # self._load_model() # Uncomment to enable local transformers
        
        if self.generator:
            try:
                prompt = f"System Assistant Answer: {query}\nResponse:"
                result = self.generator(prompt, max_length=100, num_return_sequences=1)
                return result[0]['generated_text'].replace(prompt, "").strip()
            except:
                pass
                
        return "I'm the System Assistant. I can explain our architecture, security protocols, ML models, or steganography methods. Try asking about 'encryption' or 'how the ML models work'!"

# Singleton instance
chatbot = ChatbotService()
