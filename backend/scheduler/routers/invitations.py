from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.core.deps import get_db
from backend.scheduler import models, schemas
from backend.scheduler.serialization.invitation import accept_invitation_record

router = APIRouter(prefix="/auth/invitations", tags=["invitations"])

@router.post("/accept")
def accept_invite(payload: schemas.InviteAcceptRequest, db: Session = Depends(get_db)):
    inv = db.query(models.AdminInvitation).filter(modles.AdminInvitation.token == payload.token).first()
    user = accept_invitation_record(inv, db)
    db.commit()
    return {"success": True, "user_id": user.id}
    