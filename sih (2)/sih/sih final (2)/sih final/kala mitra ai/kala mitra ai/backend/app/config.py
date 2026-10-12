"""
KALA-MITRA Backend Configuration
Configures FastAPI server, Computer Vision models (YOLOv8, SAM),
LLM endpoints (Ollama / Local Vision), and CORS settings.
"""

import os
from pathlib import Path
from pydantic import BaseModel

# Automatically load .env file from project root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

class Settings(BaseModel):
    PROJECT_NAME: str = "KALA-MITRA AI Catalog Service"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configuration
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS Origins (Allow Vite dev frontend & mobile clients)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Vision & ML model settings
    YOLO_MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "models/yolov8n.pt")
    SAM_CHECKPOINT_PATH: str = os.getenv("SAM_CHECKPOINT_PATH", "models/sam_vit_b_01ec64.pth")
    SAM_MODEL_TYPE: str = os.getenv("SAM_MODEL_TYPE", "vit_b")
    
    # LLM Settings (Ollama / Local endpoint / OpenAI-compatible endpoint)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2-vision")
    FALLBACK_LLM_MODEL: str = os.getenv("FALLBACK_LLM_MODEL", "mistral")
    
    # Image constraints
    MAX_IMAGE_SIZE_MB: int = 10
    ALLOWED_MIME_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    MAX_IMAGE_DIMENSION: int = 1920

    # Payment settings (Razorpay Test Mode)
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_TY0lRy3Jyp1wL1")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "jv8KL9ICJWBAcw0QIDcEQ60a")
    RAZORPAY_MODE: str = os.getenv("RAZORPAY_MODE", "TEST")

    # Persistence store path
    DATA_STORE_PATH: str = os.getenv("DATA_STORE_PATH", "backend/app/data/store.json")

    # Email SMTP Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "auth@kalamitra.org")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "KALA-MITRA AI")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "True").lower() in ("true", "1", "yes")

    # SMS Gateway Configuration (Twilio / Fast2SMS / MSG91)
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "console")  # 'twilio', 'fast2sms', 'msg91', 'console'
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")
    TWILIO_VERIFY_SERVICE_SID: str = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
    FAST2SMS_API_KEY: str = os.getenv("FAST2SMS_API_KEY", "")
    TEXTLOCAL_API_KEY: str = os.getenv("TEXTLOCAL_API_KEY", "")
    MSG91_AUTH_KEY: str = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_TEMPLATE_ID: str = os.getenv("MSG91_TEMPLATE_ID", "")

settings = Settings()

