import secrets
from datetime import datetime, timedelta
from fastapi import Request
from sqlalchemy.orm import Session
from backend.scheduler import models

SESSION_TTL_DAYS = 7

def _utcnow() -> datetime:
    return datetime.utcnow()

def create_user_session(db: Session, user_id: int, request: Request | None = None) -> str:
    session_id = secrets.token_urlsafe(48)
    now = _utcnow()
    row = models.UserSession(
        id = session_id,
        user_id = user_id,
        created_at = now,
        expires_at = now + timedelta(days = SESSION_TTL_DAYS),
        ip_address = (request.client.host if request and request.client else None),
        user_agent = (request.headers.get("user-agent") if request else None),
    )
    db.add(row)
    db.commit()
    return session_id

def get_user_from_session_cookie(db: Session, request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    
    now = _utcnow()
    sesh = (
        db.query(models.UserSession)
        .filter(
            models.UserSession.id == session_id,
            models.UserSession.revoked_at.is_(None),
            models.UserSession.expires_at > now,
        )
        .first()
    )
    if not sesh:
        return None
    
    return db.query(models.User).get(sesh.user_id)

def revoke_session_by_cookie(db: Session, request: Request) -> None:
    session_id = request.cookies.get("session_id")
    if not session_id:
        return
    
    sesh = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
    if not sesh or sesh.revoked_at is not None:
        return
    sesh.revoked_at = _utcnow()
    db.commit()