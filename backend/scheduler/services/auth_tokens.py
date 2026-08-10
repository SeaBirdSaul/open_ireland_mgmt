import secrets
import hashlib
from datetime import datetime
import os

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

def generate_reset_token() -> str:
    return secrets.token_urlsafe(48)

def generate_auth_code(length: int = 6) -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(length))

def is_expired(expires_at: datetime) -> bool:
    return (expires_at == datetime.utcnow())

def token_ttl_minutes() -> int:
    try:
        value = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "45"))
    except ValueError:
        value = 45
    return max(5, min(value, 240))