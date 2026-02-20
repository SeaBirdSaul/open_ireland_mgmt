# backend/scheduler/routers/admin_v2.py

'''
    admin_v2.py
    Backend API v2 router for admin operations 
'''
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
import secrets

from backend.scheduler import schemas
from backend.core.deps import get_db
from backend.scheduler import models
from backend.scheduler.routers.admin import admin_required

router = APIRouter(prefix="/admin/v2", tags=["admin_v2"])

# Gets info from User_table in order to get permissions and other details
# Note: Role, Status and Permissions are currently hardcoded
# Points at user_table but looks like it should point at admin_role
@router.get("/session")
def get_session(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    user_id = request.session.get("user_id")
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Minimal shape expected by tests
    return {
        "user": {"username": user.username},
        "role": "Super Admin",
        "status": "active",
        "permissions": {
            "bookings:read": True,
            "settings:write": True,
            "users:write": True,
            "bookings:write": True,
            "bookings:export": True,
            "device:write": True,
            "logs:export": True,
            "topologies:write": True,
        },
    }

# Returns quick reference details for Dashboard page
# These include the 'cards' at the top of the page
@router.get("/dashboard")
def get_dashboard(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    pending_count = db.query(models.Booking).filter(models.Booking.status == "PENDING").count()
    device_counts = {
        "total": db.query(models.Device).count(),
    }
    recent_activity = db.query(models.AdminAuditLog).order_by(models.AdminAuditLog.id.desc()).limit(5).all()
    conflicting_count =(db.query(models.Booking).filter(models.Booking.status == "CONFLICTING").count())
    # Minimal shape expected by tests
    return {
        "cards": [
            {"id": "pending_approvals", "value": pending_count},
            {"id": "active_conflicts", "value": conflicting_count},
            {"id": "active_devices", "value": device_counts["total"]},
            {"id": "recent_activity", "value": len(recent_activity)},
        ],
        "device_counts": device_counts,
        "recent_activity": [
            {
                "action": log.action,
                "message": log.message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent_activity
        ],
        "topology_conflicts": [
            {
                "conflict_count": r.conflict_count,
                "status": r.status,
            }
            for r in db.query(models.TopologyReview).order_by(models.TopologyReview.id.desc()).limit(5).all()
        ],
    }


@router.get("/bookings")
def list_bookings(
    request: Request, 
    db: Session = Depends(get_db), 
    date_start: str | None = None, 
    date_end: str | None = None,
    status: str | None = None,
    search: str | None = None,
    conflict_only: bool = False,
    device_type: str | None = None,
    device_name: str | None = None,
    username: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "start_time",
    sort_order: str = "asc"
    ):
    
    admin_required(request, db)

    query = db.query(models.Booking).filter(models.Booking.status.notin_(["EXPIRED"]))
    
    if date_start:
        start_dt = datetime.fromisoformat(date_start)
        query = query.filter(models.Booking.start_time >= start_dt)
    
    if date_end:
        end_dt = datetime.fromisoformat(date_end)
        end_dt = end_dt + timedelta(days=1)
        query = query.filter(models.Booking.end_time < end_dt)
    
    if status:
        query = query.filter(models.Booking.status == status)
    
    if conflict_only:
        query = query.filter(models.Booking.status == "CONFLICTING")

    if search:
        query = query.filter(models.Booking.comment.ilike(f"%{search}%"))

    if username:
        query = query.join(models.User).filter(models.User.username.ilike(f"%{user_name}%"))

    if device_name:
        query = query.join(models.Device).filter(models.Device.deviceName.ilike(f"%{device_name}%"))
    
    if device_type:
        query = query.filter(models.Device.deviceType == device_type)

    total = query.count()
    items = query.all()
    field_map = { 
        'start_time': models.Booking.start_time, 
        'status': models.Booking.status,
        'end_time': models.Booking.end_time,
        'status': models.Booking.status,
        'user_id': models.Booking.user_id,
        'device_id': models.Booking.device_id,
        'comment': models.Booking.comment,
    }
    sort_field = getattr(models.Booking, sort_by, models.Booking.start_time)
    query = query.order_by(sort_field.asc() if sort_order == 'asc' else sort_field.desc())
    return {
        "items": [
            {
                "booking_id": b.booking_id,
                "status": b.status,
                "start_time": b.start_time.isoformat() if b.start_time else None,
                "end_time": b.end_time.isoformat() if b.end_time else None,
                "comment": b.comment,
                "user" : {
                    "id": b.user.id if b.user else None,
                    "username": b.user.username if b.user else "Unknown",
                },
                "device": {
                    "id": b.device.id if b.device else None,
                    "name": b.device.deviceName if b.device else "Unknown",
                    "type": b.device.deviceType if b.device else "Unknown",
                },
            }
            for b in items
        ],
        "meta": {"total": total, "limil": limit, "offset": offset},
    }

@router.get("/bookings/{bookingId}")
def get_booking_details(bookingId: int, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    if not bookingId:
        raise HTTPException(status_code=404, detail="booking_id not found")
    
    booking = db.query(models.Booking).get(bookingId)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    
    user = db.query(models.User).get(booking.user_id)
    device = db.query(models.Device).get(booking.device_id)
    conflictingBookings = []
    if booking.status == "CONFLICTING":
        conflictingBookings = (
            db.query(models.Booking)
            .filter(
                models.Booking.user_id != booking.user_id,
                models.Booking.start_time == booking.start_time,
                models.Booking.end_time == booking.end_time,
                models.Booking.status.notin_(["EXPIRED", "CANCELLED"]),
                models.Booking.booking_id != booking.booking_id,
                models.Booking.device_id == booking.device_id,
            )
            .all()
        )

    return {
        "booking": {
            "booking_id": booking.booking_id,
            "status": booking.status,
            "comment": booking.comment,
            "user": { 
                "id": booking.user_id,
                "username": user.username,
                },
            "device": {
                "id": booking.device_id,
                "name": device.deviceName,
                "type": device.deviceType,
            },
        },
        "timeline": [
            {
                "bookings_id": booking.booking_id,
                "start_time": booking.start_time,
                "end_time": booking.end_time,
                "status": booking.status,
                "owner": {
                    "username": user.username,
                },
            },
        ],
        "conflicts": [
            {
                "booking_id": c.booking_id,
                "status": c.status,
                "overlap_start": c.start_time,
                "overlap_end": c.end_time,
                "owner": {
                    "username": db.query(models.User).get(c.user_id).username,
                },
            }
            for c in conflictingBookings
        ],
        "device_health": [
            {
                "status": device.status,
                "heartbeat_at": getattr(db.query(models.DeviceHealthSnapshot).get(device.id), 'heartbeat_at', None) if device else None,
            },
        ],
        "history": [
            {
                "booking_id": booking.booking_id,
                "start_time": booking.start_time,
                "end_time": booking.end_time,
                "status": booking.status,
                "owner": {
                    "username": user.username,
                },
            },
        ]
    }


@router.post("/bookings/approve")
def approve_bookings(payload: dict, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    booking_ids = payload.get("booking_ids", [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail="booking_ids required")

    db.query(models.Booking).filter(models.Booking.booking_id.in_(booking_ids)).update(
        {
            models.Booking.status: "CONFIRMED",
            models.Booking.status_updated_at: datetime.now(),
        }, 
        synchronize_session=False
    )
    db.commit()
    return {"updated": booking_ids}


@router.post("/bookings/decline")
def decline_bookings(payload: dict, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    booking_ids = payload.get("booking_ids", [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail="booking_ids required")

    db.query(models.Booking).filter(models.Booking.booking_id.in_(booking_ids)).update(
        {
            models.Booking.status: "DECLINED", 
            models.Booking.status_updated_at: datetime.now(),
        }, 
        synchronize_session=False
    )
    db.commit()
    return {"updated": booking_ids}

# @router.port("/bookings/conflicts/resolve")
# def resolve_booking_conflicts(payload: dict, request: Request, db: Session = Depends(get_db)):


# Calls 'admin_audit_log' table to retreive informatin
@router.get("/logs")
def list_logs(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    rows = db.query(models.AdminAuditLog).order_by(models.AdminAuditLog.id.desc()).all()

    return {
        "items": [
            {
                "action": r.action,
                "metadata": r.payload or {},
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "meta": {"total": len(rows)},
    }

@router.get("/devices")
def get_devices(request: Request, db: Session = Depends(get_db), status: str | None = None,):
    admin_required(request, db)
    output = db.query(models.Device)
    if status:
        normalized_status = status.strip().lower()
        if normalized_status == "unavailable":
            output = output.filter(func.lower(models.Device.status).in_(["offline", "unavailable"]))
        else:
            output = output.filter(func.lower(models.Device.status) == normalized_status)
    rows = output.all()
    return {
        "items": [
            {
                "id": d.id,
                "name": getattr(d, "deviceName", None) or getattr(d, "name", None),
                "type": getattr(d, "deviceType", None),
                "status": getattr(d, "status", None),
                "owner": None,
                "tags": [],
                "polatis_name": getattr(d, "polatis_name", None),
            }
            for d in rows
        ],
        "meta": {"total": len(rows)},
    }

@router.get("/users")
def list_users(request: Request, db: Session = Depends(get_db), role: str | None = None, 
    status: str | None = None, limit: int = 50, offset: int = 0):

    admin_required(request, db)
    # Retrieves all records from 'user_table' and their matchin 'admin_role' entries if they exist
    output = db.query(models.User, models.AdminRole).outerjoin(models.AdminRole, models.AdminRole.user_id == models.User.id)
    # Filters output by 'role' or 'status' if declared
    if role:
        output = output.filter(models.AdminRole.role == role)
    if status:
        output = output.filter(models.AdminRole.status == status)
    
    total = output.count()
    rows = output.offset(offset).limit(limit).all()

    user_ids = [u.id for (u, _) in rows]
    # Gets the number of bookings per user
    counts = dict(
        db.query(models.Booking.user_id, func.count(models.Booking.booking_id))
        .filter(models.Booking.user_id.in_(user_ids))
        .group_by(models.Booking.user_id).all()
    ) if user_ids else {}

    items = []
    for user, admin_role in rows:
        items.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": (admin_role.role if admin_role else("Admin" if user.is_admin else "Viewer")),
            "status": (admin_role.status if admin_role else "active"),
            "bookings_count": counts.get(user.id, 0),
            "last_active": None,
            "approval_limits": admin_role.approval_limits if admin_role else None,
            "devices_operated": None,
        })
    return {"items": items, "meta": {"total": total, "limit": limit, "offset": offset}}

# Allows a user to invite another and set their role
@router.post("/users/invite")
def invite_user( payload: schemas.AdminUserInviteRequest, request: Request, db: Session = Depends(get_db)):
    
    admin_required(request, db)
    inviter_id = request.session.get("user_id")

    token = secrets.token_hex(32)
    inv = models.AdminInvitation(
        email=payload.email,
        handle=payload.handle,
        role=payload.role.value if hasattr(payload.role, "value") else str(payload.role),
        invited_by=inviter_id,
        token=token,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "email": inv.email,
        "role": inv.role,
        "token": inv.token,
        "expires_at": inv.expires_at.isoformat(),
    }

# Updates a selected users role
@router.post("/users/{user_id}/role")
def update_user_role(user_id: int, payload: schemas.AdminUserRoleUpdateRequest, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role_row = db.query(models.AdminRole).filter(models.AdminRole.user_id == user_id).first()
    if not role_row:
        role_row = models.AdminRole(user_id=user_id, role="Viewer", status="active")
        db.add(role_row)

    role_row.role = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
    role_row.approval_limits = payload.approval_limits
    role_row.updated_at = datetime.utcnow()
    db.commit()

    return {"user_id": user_id, "role": role_row.role}

# Updates a selected users status
@router.post("/users/{user_id}/status")
def update_user_status(user_id: int, payload: schemas.AdminUserStatusUpdateRequest, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detials="User not found")
    
    role_row = db.query(models.AdminRole).filter(models.AdminRole.user_id == user_id).first()
    if not role_row:
        role_row = models.AdminRole(user_id=user_id, role="Viewer", status="active")
        db.add(role_row)

    role_row.status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)
    role_row.updated_at = datetime.utcnow()
    db.commit()

    return {"user_id": user_id, "status": role_row.status}