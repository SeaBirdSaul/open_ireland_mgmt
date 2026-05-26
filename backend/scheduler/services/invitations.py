from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
import pytz
from backend.core.deps import get_db
from backend.scheduler import models

# Timezone for Ireland
IRELAND_TZ = pytz.timezone('Etc/GMT-1')

def _is_invitation_expired(expires_at: datetime) -> bool:
    now = datetime.now(IRELAND_TZ)
    if expires_at.tzinfo is None:
        return expires_at <= now.replace(tzinfo=None)
    return expires_at <= now

def _derive_status(inv: models.AdminInvitation) -> str:
    if inv.accepted_at:
        return "accepted"
    if _is_invitation_expired(inv.expires_at):
        return "expired"
    return "pending"


def accept_invitation_record(inv: models.AdminInvitation, db: Session) -> models.User:
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid invitation token")
    if inv.accepted_at:
        raise HTTPException(status_code=409, detail="Invitation already accepted")
    if _is_invitation_expired(inv.expires_at):
        raise HTTPException(status_code=410, detail="Invitation expired")

    # gets registed handle or the start of the email address if no handle provided
    username = (inv.handle or inv.email.split("@")[0]).strip()

    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(models.User).filter(models.User.email == inv.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    
    user = models.User(
        username = username,
        email = inv.email,
        firstName = inv.firstName,
        lastName = inv.lastName,
        password = inv.password,
        role = inv.role.lower(),
        status = "active",
    )
    db.add(user)
    db.flush()

    inv.accepted_at = datetime.now(IRELAND_TZ)
    db.commit()
    return user

def serialize_invitation(inv: models.AdminInvitation) -> dict:
    inviter_username = inv.inviter.username if inv.inviter else None
    return {
        "id": inv.id,
        "email": inv.email,
        "firstName": inv.firstName,
        "lastName": inv.lastName,
        "handle": inv.handle,
        "role": inv.role,
        "notes": inv.notes,
        "invited_by": inv.invited_by,
        "inviter_username": inviter_username,
        "created_at": inv.created_at,
        "expires_at": inv.expires_at,
        "accepted_at": inv.accepted_at,
        "status": _derive_status(inv),
    }
