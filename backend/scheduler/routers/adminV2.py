# backend/scheduler/routers/admin_v2.py

'''
    admin_v2.py
    Backend API v2 router for admin operations 
'''
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from pydantic import BaseModel
import secrets
import pytz

from backend.scheduler import schemas, models
from backend.core.deps import get_db
from backend.scheduler import models
from backend.inventory import models as inventory_models
from backend.scheduler.routers.admin import admin_required, super_admin_required
from backend.core.hash import hash_password
from backend.scheduler.services.invitations import accept_invitation_record, serialize_invitation
from backend.scheduler.services.sessions import get_user_from_session_cookie
from backend.core.discord_utils import send_admin_action_notification
# Timezone for Ireland
IRELAND_TZ = pytz.timezone('Etc/GMT-1')

from backend.scheduler.services.maintenance import (
    apply_maintenance_to_devices, 
    apply_blocking_status_to_devices,
    device_is_entering_maintenance,
    is_maintenance_window_valid,
    is_maintenance_active_at,
    resolve_status_for_scheduled_maintenance
)

router = APIRouter(prefix="/admin/v2", tags=["admin_v2"])

class DeviceStatusUpdateRequset(BaseModel):
    device_ids: list[int]
    status: str
    maintenance_start: str | None = None
    maintenance_end: str | None = None

def sync_inventory_device_status(
    db: Session,
    *,
    device_name: str,
    device_type: str | None,
    status: str | None,
    maintenance_start: str | None,
    maintenance_end: str | None,
) -> None:
    inventory_device = (
        db.query(inventory_models.InventoryDevice)
        .filter(inventory_models.InventoryDevice.deviceName == device_name)
        .filter(inventory_models.InventoryDevice.deviceType == device_type)
        .first()
    )

    if not inventory_device:
        return
    
    inventory_device.status = status
    inventory_device.maintenance_start = maintenance_start
    inventory_device.maintenance_end = maintenance_end

def _build_group_devices_summary(device_ranges: dict[tuple[str, str], dict]) -> str:
    MAX_DISCORD_MESSAGE_LEN = 1900

    device_lines = []
    for (device_type, device_name), times in sorted(device_ranges.items()):
        start_str = times["start"].strftime("%Y-%m-%d %H:%M")
        end_str = times["end"].strftime("%Y-%m-%d %H:%M")
        device_lines.append(
            f"> Device: **{device_type} - {device_name}**: {start_str} - {end_str}"
        )
    
    kept_lines = []
    for idx, line in enumerate(device_lines):
        remaining = len(device_lines) - (idx + 1)
        suffix = f"\n> ...and {remaining} more affected device(s)." if remaining > 0 else ""
        candidate = "\n".join(kept_lines + [line]) + suffix
        if len(candidate) > MAX_DISCORD_MESSAGE_LEN:
            break
        kept_lines.append(line)
    
    omitted = len(device_lines) - len(kept_lines)
    result = "\n".join(kept_lines)
    if omitted > 0:
        result += f"/n> ...and {omitted} more affected device(s)."
    
    return result

# Gets info from User_table in order to get permissions and other details
# Note: Role, Status and Permissions are currently hardcoded
# Points at user_table but looks like it should point at admin_role
@router.get("/session")
def get_session(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    user = get_user_from_session_cookie(db, request)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Minimal shape expected by tests
    return {
        "user": {"username": user.username},
        "role": user.role,
        "status": user.status,
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
        "offline": db.query(models.Device).filter(models.Device.status == "Unavailable").count(),
        "maintenance": db.query(models.Device).filter(models.Device.status == "Maintenance").count(),
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
                "grouped_booking_id": b.grouped_booking_id,
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
                "collaborators": b.collaborators or [],
                "has_collaborators": bool(b.collaborators),
                "is_collaborator": bool(b.is_collaborator),
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
    
    # Get all bookings in the group
    group_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == booking.grouped_booking_id)
        .all()
    )
    
    # Collect all devices and their time periods in the group
    devices_in_group = []
    device_ranges = {}
    for gb in group_bookings:
        dev = db.query(models.Device).get(gb.device_id)
        device_key = (dev.deviceType, dev.deviceName)
        if device_key not in device_ranges:
            device_ranges[device_key] = {'start': gb.start_time, 'end': gb.end_time, 'device_id': dev.id}
        else:
            device_ranges[device_key]['start'] = min(device_ranges[device_key]['start'], gb.start_time)
            device_ranges[device_key]['end'] = max(device_ranges[device_key]['end'], gb.end_time)
    
    for (device_type, device_name), times in device_ranges.items():
        devices_in_group.append({
            "name": device_name,
            "type": device_type,
            "start_time": times['start'].isoformat(),
            "end_time": times['end'].isoformat(),
        })
    
    # Collect all collaborators/users in the group
    collaborators = []
    collaborator_ids = set()
    for gb in group_bookings:
        if gb.user and gb.user_id not in collaborator_ids:
            collaborators.append({
                "id": gb.user.id,
                "username": gb.user.username,
            })
            collaborator_ids.add(gb.user_id)
    
    # Find conflicting bookings for this group
    conflictingBookings = []
    if booking.status == "CONFLICTING":
        # Get all devices in the group
        group_device_ids = [gb.device_id for gb in group_bookings]
        # Find any conflicting bookings on those devices during those times
        conflictingBookings = (
            db.query(models.Booking)
            .filter(
                models.Booking.grouped_booking_id != booking.grouped_booking_id,
                models.Booking.device_id.in_(group_device_ids),
                models.Booking.status.notin_(["EXPIRED", "CANCELLED"]),
            )
            .all()
        )
        # Filter to only those that actually overlap
        conflictingBookings = [
            c for c in conflictingBookings
            if any(
                not (c.end_time <= gb.start_time or c.start_time >= gb.end_time)
                for gb in group_bookings
            )
        ]

    return {
        "booking": {
            "booking_id": booking.booking_id,
            "grouped_booking_id": booking.grouped_booking_id,
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
        "group_info": {
            "is_group_booking": len(group_bookings) > 1,
            "group_size": len(group_bookings),
            "devices": devices_in_group,
            "collaborators": collaborators,
            "group_bookings": [
                {
                    "booking_id": gb.booking_id,
                    "user": {
                        "id": gb.user.id if gb.user else None,
                        "username": gb.user.username if gb.user else "Unknown",
                    },
                    "device": {
                        "id": gb.device_id,
                        "name": db.query(models.Device).get(gb.device_id).deviceName if gb.device_id else "Unknown",
                        "type": db.query(models.Device).get(gb.device_id).deviceType if gb.device_id else "Unknown",
                    },
                    "start_time": gb.start_time.isoformat(),
                    "end_time": gb.end_time.isoformat(),
                    "status": gb.status,
                    "comment": gb.comment,
                    "is_collaborator": bool(gb.is_collaborator),
                    "collaborators": gb.collaborators or [],
                }
                for gb in group_bookings
            ],
        },
        "timeline": [
            {
                "bookings_id": gb.booking_id,
                "start_time": gb.start_time.isoformat(),
                "end_time": gb.end_time.isoformat(),
                "status": gb.status,
                "owner": {
                    "username": db.query(models.User).get(gb.user_id).username if gb.user_id else "Unknown",
                },
            }
            for gb in group_bookings
        ],
        "conflicts": [
            {
                "booking_id": c.booking_id,
                "status": c.status,
                "overlap_start": c.start_time.isoformat(),
                "overlap_end": c.end_time.isoformat(),
                "owner": {
                    "username": db.query(models.User).get(c.user_id).username if c.user_id else "Unknown",
                },
                "device": {
                    "name": db.query(models.Device).get(c.device_id).deviceName if c.device_id else "Unknown",
                    "type": db.query(models.Device).get(c.device_id).deviceType if c.device_id else "Unknown",
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
                "booking_id": gb.booking_id,
                "start_time": gb.start_time.isoformat(),
                "end_time": gb.end_time.isoformat(),
                "status": gb.status,
                "owner": {
                    "username": db.query(models.User).get(gb.user_id).username if gb.user_id else "Unknown",
                },
            }
            for gb in group_bookings
        ]
    }


@router.post("/bookings/approve")
def approve_bookings(payload: dict, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    admin_required(request, db)
    booking_ids = payload.get("booking_ids", [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail="booking_ids required")

    bookings = db.query(models.Booking).filter(models.Booking.booking_id.in_(booking_ids)).all()
    if not bookings:
        raise HTTPException(status_code=404, detail="No matching bookings found")

    grouped_ids = {booking.grouped_booking_id for booking in bookings}

    db.query(models.Booking).filter(models.Booking.grouped_booking_id.in_(grouped_ids)).update(
        {
            models.Booking.status: "CONFIRMED",
            models.Booking.status_updated_at: datetime.now(IRELAND_TZ).replace(tzinfo=None),
        },
        synchronize_session=False,
    )
    db.commit()

    all_group_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id.in_(grouped_ids))
        .all()
    )

    unique_targets: dict[str, models.User] = {}
    for booking in all_group_bookings:
        user = booking.user
        if user and user.discord_id:
            unique_targets[user.discord_id] = user

    for discord_id, user in unique_targets.items():
        # Get all bookings for this user in the affected groups
        user_bookings = [b for b in all_group_bookings if b.user and b.user.discord_id == discord_id]
        if not user_bookings:
            continue
        # Group bookings by device and find overall time range for each device
        device_ranges = {}
        for b in user_bookings:
            device_key = (b.device.deviceType, b.device.deviceName)
            if device_key not in device_ranges:
                device_ranges[device_key] = {'start': b.start_time, 'end': b.end_time}
            else:
                device_ranges[device_key]['start'] = min(device_ranges[device_key]['start'], b.start_time)
                device_ranges[device_key]['end'] = max(device_ranges[device_key]['end'], b.end_time)
        
        devices_str = _build_group_devices_summary(device_ranges)
        
        # Check if this is a collaborative booking
        collab_info = ""
        if len(all_group_bookings) > 1:
            collaborator_users = set()
            for b in all_group_bookings:
                if b.user and b.user.username:
                    collaborator_users.add(b.user.username)
            # Remove current user to show only "other" collaborators
            if user.username:
                collaborator_users.discard(user.username)
            if collaborator_users:
                collab_str = ", ".join(sorted(collaborator_users))
                collab_info = f"> **Collaborative booking with:** {collab_str}\n"
        
        msg = (
            f":white_check_mark: <@{discord_id}>, your booking has been **CONFIRMED** by admin.\n"
            f"{collab_info}{devices_str}"
        )
        background_tasks.add_task(send_admin_action_notification, msg, discord_id)

    return {"updated": booking_ids}


@router.post("/bookings/decline")
def decline_bookings(payload: dict, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    admin_required(request, db)
    booking_ids = payload.get("booking_ids", [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail="booking_ids required")

    bookings = db.query(models.Booking).filter(models.Booking.booking_id.in_(booking_ids)).all()
    if not bookings:
        raise HTTPException(status_code=404, detail="No matching bookings found")

    grouped_ids = {booking.grouped_booking_id for booking in bookings}

    db.query(models.Booking).filter(models.Booking.grouped_booking_id.in_(grouped_ids)).update(
        {
            models.Booking.status: "DECLINED",
            models.Booking.status_updated_at: datetime.now(IRELAND_TZ).replace(tzinfo=None),
        },
        synchronize_session=False,
    )
    db.commit()

    all_group_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id.in_(grouped_ids))
        .all()
    )

    unique_targets: dict[str, models.User] = {}
    for booking in all_group_bookings:
        user = booking.user
        if user and user.discord_id:
            unique_targets[user.discord_id] = user

    for discord_id, user in unique_targets.items():
        # Get all bookings for this user in the affected groups
        user_bookings = [b for b in all_group_bookings if b.user and b.user.discord_id == discord_id]
        if not user_bookings:
            continue
        # Group bookings by device and find overall time range for each device
        device_ranges = {}
        for b in user_bookings:
            device_key = (b.device.deviceType, b.device.deviceName)
            if device_key not in device_ranges:
                device_ranges[device_key] = {'start': b.start_time, 'end': b.end_time}
            else:
                device_ranges[device_key]['start'] = min(device_ranges[device_key]['start'], b.start_time)
                device_ranges[device_key]['end'] = max(device_ranges[device_key]['end'], b.end_time)
        
        devices_str = _build_group_devices_summary(device_ranges)
        
        # Check if this is a collaborative booking
        collab_info = ""
        if len(all_group_bookings) > 1:
            collaborator_users = set()
            for b in all_group_bookings:
                if b.user and b.user.username:
                    collaborator_users.add(b.user.username)
            # Remove current user to show only "other" collaborators
            if user.username:
                collaborator_users.discard(user.username)
            if collaborator_users:
                collab_str = ", ".join(sorted(collaborator_users))
                collab_info = f"> **Collaborative booking with:** {collab_str}\n"
        
        msg = (
            f":x: <@{discord_id}>, your booking has been **DECLINED** by admin.\n"
            f"{collab_info}{devices_str}"
        )
        background_tasks.add_task(send_admin_action_notification, msg, discord_id)

    return {"updated": booking_ids}


@router.post("/bookings/return-to-pending")
def return_bookings_to_pending(payload: dict, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    super_admin_required(request, db)
    booking_ids = payload.get("booking_ids", [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail="booking_ids required")

    bookings = db.query(models.Booking).filter(models.Booking.booking_id.in_(booking_ids)).all()
    if not bookings:
        raise HTTPException(status_code=404, detail="No matching bookings found")

    grouped_ids = {booking.grouped_booking_id for booking in bookings}

    db.query(models.Booking).filter(models.Booking.grouped_booking_id.in_(grouped_ids)).update(
        {
            models.Booking.status: "PENDING",
            models.Booking.status_updated_at: datetime.now(IRELAND_TZ).replace(tzinfo=None),
        },
        synchronize_session=False,
    )
    db.commit()

    all_group_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id.in_(grouped_ids))
        .all()
    )

    unique_targets: dict[str, models.User] = {}
    for booking in all_group_bookings:
        user = booking.user
        if user and user.discord_id:
            unique_targets[user.discord_id] = user

    for discord_id, user in unique_targets.items():
        # Get all bookings for this user in the affected groups
        user_bookings = [b for b in all_group_bookings if b.user and b.user.discord_id == discord_id]
        if not user_bookings:
            continue
        # Group bookings by device and find overall time range for each device
        device_ranges = {}
        for b in user_bookings:
            device_key = (b.device.deviceType, b.device.deviceName)
            if device_key not in device_ranges:
                device_ranges[device_key] = {'start': b.start_time, 'end': b.end_time}
            else:
                device_ranges[device_key]['start'] = min(device_ranges[device_key]['start'], b.start_time)
                device_ranges[device_key]['end'] = max(device_ranges[device_key]['end'], b.end_time)
        

        devices_str = _build_group_devices_summary(device_ranges)
        
        # Check if this is a collaborative booking
        collab_info = ""
        if len(all_group_bookings) > 1:
            collaborator_users = set()
            for b in all_group_bookings:
                if b.user and b.user.username:
                    collaborator_users.add(b.user.username)
            # Remove current user to show only "other" collaborators
            if user.username:
                collaborator_users.discard(user.username)
            if collaborator_users:
                collab_str = ", ".join(sorted(collaborator_users))
                collab_info = f"> **Collaborative booking with:** {collab_str}\n"
        
        msg = (
            f":arrows_counterclockwise: <@{discord_id}>, your booking has been **RETURNED TO PENDING** by admin.\n"
            f"{collab_info}{devices_str}"
        )
        background_tasks.add_task(send_admin_action_notification, msg, discord_id)

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
                "actor": db.query(models.User).get(r.actor_id),
                "action": r.action,
                "metadata": r.payload or {},
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "entity": r.entity_id,
                "outcome": r.outcome,
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

@router.get("/devices/{device_id}")
def get_device_detail(
    device_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    admin_required(request, db)

    device = (
        db.query(models.Device)
        .filter(models.Device.id == device_id)
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return device

@router.put("/devices/{device_id}")
def update_device_detail(
    device_id: int,
    payload: schemas.DeviceUpdateFull,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    admin_required(request, db)

    device = (
        db.query(models.Device)
        .filter(models.Device.id == device_id)
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    previous_status = device.status

    existing_polatis = (
        db.query(models.Device)
        .filter(
            models.Device.id != device_id,
            models.Device.deviceType == payload.deviceType,
            models.Device.deviceName == payload.deviceName,
            models.Device.polatis_name == payload.polatis_name,
        )
        .first()
    )
    if existing_polatis:
        raise HTTPException(status_code=400, detail="Polatis name already exists in this device group")

    if payload.ip_address:
        existing_ip_conflict = (
            db.query(models.Device)
            .filter(
                models.Device.id != device_id,
                models.Device.ip_address == str(payload.ip_address),
                or_(
                    models.DeviceType.name != payload.deviceType,
                    models.Device.name != payload.deviceName,
                ),
            )
            .first()
        )
        if existing_ip_conflict:
            raise HTTPException(status_code=400, detail="IP address already exists for another device")
        
    # if payload.deviceType != device.deviceType:
    #     next_device_type = (
    #         db.query(models.DeviceType)
    #         .filter(models.DeviceType.name == payload.deviceType)
    #         .first()
    #     )
    #     if not next_device_type:
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"DeviceType '{payload.deviceType}' not found. Please create it via inventory API first."
    #         )
        
    device.deviceType = payload.deviceType
    device.deviceName = payload.deviceName
    device.polatis_name = payload.polatis_name
    
    device.ip_address = str(payload.ip_address) if payload.ip_address else None
    
    blocking_result = None

    if payload.status == "Maintenance":
        if not is_maintenance_window_valid(payload.maintenance_start, payload.maintenance_end):
            raise HTTPException(status_code=400, detail="Valid maintenance start and end are required.")

        if previous_status != "Maintenance":
            device.maintenance_return_status = previous_status or "Available"

        device.maintenance_start = payload.maintenance_start
        device.maintenance_end = payload.maintenance_end
        device.status = resolve_status_for_scheduled_maintenance(
            requested_status=payload.status,
            previous_status=previous_status,
            maintenance_start=payload.maintenance_start,
            maintenance_end=payload.maintenance_end,
            fallback_status=getattr(device, "maintenance_return_status", None) or "Available",
        )

        if (
            device_is_entering_maintenance(previous_status, device.status)
            and is_maintenance_active_at(
                maintenance_start=device.maintenance_start,
                maintenance_end=device.maintenance_end,
            )
        ):
            blocking_result = apply_blocking_status_to_devices(
                db,
                devices=[device],
                reason_status="Maintenance",
            )

    elif payload.status == "Unavailable":
        device.status = "Unavailable"
        device.maintenance_start = None
        device.maintenance_end = None
        if hasattr(device, "maintenance_return_status"):
            device.maintenance_return_status = None

        if previous_status != "Unavailable":
            blocking_result = apply_blocking_status_to_devices(
                db,
                devices=[device],
                reason_status="Unavailable",
            )

    else:
        device.status = payload.status
        device.maintenance_start = None
        device.maintenance_end = None
        if hasattr(device, "maintenance_return_status"):
            device.maintenance_return_status = None

    device.Out_Port = payload.Out_Port
    device.In_Port = payload.In_Port

    sync_inventory_device_status(
        db,
        device_name = device.deviceName,
        device_type = device.deviceType,
        status = device.status,
        maintenance_start = device.maintenance_start,
        maintenance_end = device.maintenance_end
    )

    maintenance_result = None
    if (device_is_entering_maintenance(previous_status, device.status) and is_maintenance_active_at(maintenance_start = device.maintenance_start, maintenance_end = device.maintenance_end)):
        maintenance_result = apply_blocking_status_to_devices(db, devices=[device], reason_status="Maintenance")

    db.commit()
    db.refresh(device)

    if blocking_result:
        for notification in blocking_result.notifications:
            if notification.discord_id:
                background_tasks.add_task(
                    send_admin_action_notification,
                    notification.message,
                    notification.discord_id
                )

    return {
        "device": device,
        "maintenance": {
            "affected_booking_ids": blocking_result.affected_booking_ids if blocking_result else [],
            "affected_count": blocking_result.affected_count if blocking_result else 0
        }
    }

@router.post("/devices/status")
def update_device_status(
    payload: DeviceStatusUpdateRequset,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    admin_required(request, db)

    allowed_statuses = {"Available", "Maintenance", "Offline", "Unavailable"}
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid  device status")
    
    rows = (
        db.query(models.Device)
        .filter(models.Device.id.in_(payload.device_ids))
        .all()
    )
    maintenance_candidates = []
    unavailable_candidates = []

    for device in rows:
        previous_status = device.status
        requested_status = "Unavailable" if payload.status == "Offline" else payload.status

        if requested_status == "Maintenance":
            if not is_maintenance_window_valid(payload.maintenance_start, payload.maintenance_end):
                raise HTTPException(status_code=400, detail="Valid maintenance start and end are required.")

            if previous_status != "Maintenance":
                device.maintenance_return_status = previous_status or "Available"
            
            device.maintenance_start = payload.maintenance_start
            device.maintenance_end = payload.maintenance_end
            device.status = resolve_status_for_scheduled_maintenance(
                requested_status = requested_status,
                previous_status = previous_status,
                maintenance_start = payload.maintenance_start,
                maintenance_end = payload.maintenance_end,
                fallback_status = getattr(device, "maiantenance_return_status", None) or "Available",
            )

            if (
                device_is_entering_maintenance(previous_status, device.status)
                and is_maintenance_active_at(
                    maintenance_start = device.maintenance_start,
                    maintenance_end = device.maintenance_end
                )
            ):
                maintenance_candidates.append(device)
        
        elif requested_status == "Unavailable":
            device.status = "Unavailable"
            device.maintenance_start = None
            device.maintenance_end = None
            if hasattr(device, "maintenance_return_status"):
                device.maintenance_return_status = None
            
            if previous_status != "Unavailable":
                unavailable_candidates.append(device)
        
        else:
            device.status = requested_status
            device.maintenance_start = None
            device.maintenance_end = None
            if hasattr(device, "maintenance_return_status"):
                device.maintenance_return_status = None
        
        sync_inventory_device_status(
            db,
            device_name=device.deviceName,
            device_type=device.deviceType,
            status=device.status,
            maintenance_start=device.maintenance_start,
            maintenance_end=device.maintenance_end,
        )
    maintenance_result = None
    unavailable_result = None

    if maintenance_candidates:
        maintenance_result = apply_blocking_status_to_devices(db, devices=maintenance_candidates, reason_status="Maintenance")

    if unavailable_candidates:
            unavailable_result = apply_blocking_status_to_devices(db, devices=unavailable_candidates, reason_status="Unavailable")
        
    combined_notifications = []
    affected_booking_ids = []
    affected_count = 0

    for result in (maintenance_result, unavailable_result):
        if not result:
            continue
        combined_notifications.extend(result.notifications)
        affected_booking_ids.extend(result.affected_booking_ids)
        affected_count += result.affected_count

    db.commit()
    
    if combined_notifications:
        for notification in combined_notifications:
            if notification.discord_id:
                background_tasks.add_task(
                    send_admin_action_notification, 
                    notification.message,
                    notification.discord_id
                )

    return {
        "updated": [device.id for device in rows],
        "maintenance": {
            "affected_booking_ids": sorted(set(affected_booking_ids)),
            "affected_count": affected_count,
        },
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
            "role": user.role,
            "status": user.status,
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
    current_user = get_user_from_session_cookie(db, request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    inviter_id = current_user.id

    normalized_email = (payload.email or "").strip().lower() or None

    if normalized_email:
        existing_email = db.query(models.User).filter(models.User.email == normalized_email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email is already in use.")

    token = secrets.token_hex(32)
    sha_password = hashlib.sha256(payload.password.encode("utf-8")).hexdigest()
    hashed_password = hash_password(sha_password)
    inv = models.AdminInvitation(
        email=normalized_email,
        firstName=payload.firstName.strip(),
        lastName=payload.lastName.strip(),
        handle=payload.handle.strip() if payload.handle else None,
        password=hashed_password,
        role=payload.role.value if hasattr(payload.role, "value") else str(payload.role),
        notes=payload.notes.strip() if payload.notes else None,
        invited_by=inviter_id,
        token=token,
        expires_at=datetime.now(IRELAND_TZ) + timedelta(days=7),
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

@router.get("/invitations")
def list_invites(
    request: Request,
    db: Session = Depends(get_db),
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    admin_required(request, db)

    query = db.query(models.AdminInvitation).order_by(models.AdminInvitation.created_at.desc())
    rows = query.offset(offset).limit(limit).all()

    items = [serialize_invitation(inv) for inv in rows]
    if status:
        items = [i for i in items if i["status"] == status]
    
    total = len(items) if status else query.count()
    return {"items": items, "meta": {"total": total, "limit": limit, "offset": offset}}

@router.post("/invitations/{invitation_id}/approve")
def approve_invitation(invitation_id: int, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    inv = db.query(models.AdminInvitation).get(invitation_id)
    if not inv:
        raise HTTPException(status=404, detail="Invitation not found")
    
    user = accept_invitation_record(inv, db)
    db.commit()
    return {"invitation_id": invitation_id, "status": "accepted", "user_id": user.id, "username": user.username}

@router.post("/invitations/{invitation_id}/reject")
def reject_invitation(
    invitation_id: int,
    payload: schemas.AdminInvitationRejectRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    admin_required(request, db)

    inv = db.query(models.AdminInvitation).get(invitation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.accepted_at:
        raise HTTPException(status_code=409, detail="Invitation already accepted")
    
    db.delete(inv)
    db.commit()
    return {"invitation_id": invitation_id, "status": "rejected"}

# Updates a selected users role
@router.post("/users/{user_id}/role")
def update_user_role(user_id: int, payload: schemas.AdminUserRoleUpdateRequest, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = payload.role.value if hasattr(payload.role, "value") else str(payload.role)

    user.role = new_role
    
    role_row = db.query(models.AdminRole).filter(models.AdminRole.user_id == user_id).first()
    if not role_row:
        role_row = models.AdminRole(user_id=user_id, role=new_role, status=(user.status or "active"))
        db.add(role_row)

    role_row.role = new_role
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
    
    new_status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)

    user.status = new_status
    
    role_row = db.query(models.AdminRole).filter(models.AdminRole.user_id == user_id).first()
    if not role_row:
        role_row = models.AdminRole(user_id=user_id, role=(user.role or "viewer"), status=new_status)
        db.add(role_row)

    role_row.status = new_status
    role_row.updated_at = datetime.utcnow()
    db.commit()

    return {"user_id": user_id, "status": role_row.status}

@router.get("/bookings/group/{group_id}")
def get_booking_group_details(group_id: str, request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)

    rows = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == group_id)
        .order_by(models.Booking.start_time.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status=404, detail="Booking group not found")

    lead = rows[0]
    owner = lead.user
    
    comments = [c for c in { (b.comment or "").strip() for b in rows } if c]

    device_map = {}
    for b in rows:
        dkey = b.device_id
        if dkey not in device_map:
            device_map[dkey] = {
                "device_id": b.device_id,
                "device_name": b.device.deviceName if b.device else "Unknown",
                "device_type": b.device.deviceType if b.device else "Unknown",
                "first_start_time": b.start_time,
                "last_end_time": b.end_time,
                "statuses": set([b.status]),
                "booking_count": 1,
            }
        else:
            item = device_map[dkey]
            item["first_start_time"] = min(item["first_start_time"], b.start_time)
            item["last_end_time"] = max(item["last_end_time"], b.end_time)
            item["statuses"].add(b.status)
            item["booking_count"] += 1
    
    owner_rows = [b for b in rows if not b.is_collaborator]
    collaborators = sorted({
        name
        for b in owner_rows
        for name in (b.collaborators or [])
    })
    devices = []
    for v in device_map.values():
        devices.append({
            "device_id": v["device_id"],
            "device_name": v["device_name"],
            "device_type": v["device_type"],
            "first_start_time": v["first_start_time"].isoformat() if v["first_start_time"] else None,
            "last_end_time": v["last_end_time"].isoformat() if v["last_end_time"] else None,
            "statuses": sorted(list(v["statuses"])),
            "booking_count": v["booking_count"],
        })

    return {
        "grouped_booking_id": group_id,
        "owner": {
            "id": owner.id if owner else None,
            "username": owner.username if owner else "Unknown",
        },
        "summary": {
            "statuses": sorted({b.status for b in rows}),
            "count": len(rows),
            "group_start": min(b.start_time for b in rows).isoformat(),
            "group_end": max(b.end_time for b in rows).isoformat(),
            "comments": comments,
            "collaborators": collaborators,
            "has_collaborators": bool(collaborators),
            "collaborator_count": len(collaborators),
        },
        "devices": devices,
        "bookings": [
            {
                "booking_id": b.booking_id,
                "status": b.status,
                "start_time": b.start_time.isoformat() if b.start_time else None,
                "end_time": b.end_time.isoformat() if b.end_time else None,
                "comment": b.comment,
                "device": {
                    "id": b.device.id if b.device else None,
                    "name": b.device.deviceName if b.device else "Unknown",
                    "type": b.device.deviceType if b.device else "Unknown",
                },
                "collaborators": b.collaborators or [],
                "is_collaborator": bool(b.is_collaborator),
            }
            for b in rows
        ],
    }

@router.delete("/users/{user_id}")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    super_admin_required(request, db)

    current_user = get_user_from_session_cookie(db, request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Transfers ownership of any collab bookings from the deleted user to a collab user
    transfer_owned_booking_groups(db, user_id)

    # Delete all relevant DB entries to avoid FK errors
    db.query(models.Booking).filter(
        models.Booking.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.BookingFavorite).filter(
        models.BookingFavorite.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.Topology).filter(
        models.Topology.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.AdminRole).filter(
        models.AdminRole.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.DeviceOwnership).filter(
        (models.DeviceOwnership.owner_id == user_id) | 
        (models.DeviceOwnership.assigned_by == user_id)
    ).delete(synchronize_session=False)

    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.UserSession).filter(
        models.UserSession.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(models.AdminInvitation).filter(
        models.AdminInvitation.invited_by == user_id
    ).delete(synchronize_session=False)


    # Preserve records, but remove FK link to deleted user
    db.query(models.AdminAuditLog).filter(
        models.AdminAuditLog.actor_id == user_id
        ).update(
            {models.AdminAuditLog.actor_id: None}, 
            synchronize_session=False
        )

    db.query(models.TopologyReview).filter(
        models.TopologyReview.resolved_by == user_id
        ).update(
            {models.TopologyReview.resolved_by: None},
            synchronize_session=False
        )

    db.query(models.AdminSetting).filter(
        models.AdminSetting.updated_by == user_id
        ).update(
            {models.AdminSetting.updated_by: None}, 
            synchronize_session=False
        )
    

    db.delete(user)
    db.commit()
    return {"user_id":  user_id, "deleted": True}


def choose_new_owner(db, owner_bookings):
    collaborator_names = []
    seen = set()

    for bookings in owner_bookings:
        for name in (bookings.collaborators or []):
            normalized = name.strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            collaborator_names.append(name.strip())

    if not collaborator_names:
        return None
    
    candidates = (
        db.query(models.User)
        .filter(models.User.username.in_(collaborator_names))
        .all()
    )
    by_name = {u.username.lower(): u for u in candidates}

    for name in collaborator_names:
        user = by_name.get(name.lower())
        if user:
            return user
    
    return None

def transfer_owned_booking_groups(db: Session, deleted_user_id: int) -> None:
    owned_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.user_id == deleted_user_id,
            models.Booking.is_collaborator.is_(False)
        )
        .order_by(
            models.Booking.grouped_booking_id, 
            models.Booking.start_time, 
            models.Booking.booking_id
        )
        .all()
    )

    by_group = {}
    for booking in owned_bookings:
        by_group.setdefault(booking.grouped_booking_id, []).append(booking)

    for group_id, group_bookings in by_group.items():
        new_owner = choose_new_owner(db, group_bookings)

        if not new_owner:
            db.query(models.Booking).filter(
                models.Booking.grouped_booking_id == group_id
            ).delete(synchronize_session=False)
            continue
        
        planned_promotions = []

        for owner_booking in group_bookings:
            replacement = (
                db.query(models.Booking)
                .filter(
                    models.Booking.grouped_booking_id == owner_booking.grouped_booking_id,
                    models.Booking.device_id == owner_booking.device_id,
                    models.Booking.start_time == owner_booking.start_time,
                    models.Booking.end_time == owner_booking.end_time,
                    models.Booking.user_id == new_owner.id,
                    models.Booking.is_collaborator.is_(True),
                )
                .first()
            )

            if not replacement:
                planned_promotions = None
                break

            remaining_collaborators = [
                name
                for name in (owner_booking.collaborators or [])
                if name.strip().lower() != new_owner.username.lower()
            ]

            planned_promotions.append((owner_booking, replacement, remaining_collaborators))

        if planned_promotions is None:
            db.query(models.Booking).filter(
                models.Booking.grouped_booking_id == group_id
            ).delete(synchronize_session=False)
            continue
        
        for owner_booking, replacement, remaining_collaborators in planned_promotions:
            replacement.is_collaborator = False
            replacement.collaborators = remaining_collaborators or None
            replacement.cooment = owner_booking.comment
            replacement.status = owner_booking.status
            replacement.status_updated_at = owner_booking.status_updated_at
            db.delete(owner_booking)
