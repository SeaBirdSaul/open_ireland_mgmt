'''
Admin router for user registration, login, device management, and booking approvals.
Includes admin authentication and session management.
'''
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
import pytz
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
# Phase U2: Import InventoryDevice as Device for unified device management
from backend.inventory.models import InventoryDevice as Device, DeviceType
from backend.scheduler import models, schemas
from backend.core.deps import get_db

from backend.core.hash import hash_password, verify_password
from backend.core.discord_utils import send_admin_action_notification

from fastapi.responses import JSONResponse
from backend.scheduler.services.sessions import create_user_session, get_user_from_session_cookie, revoke_session_by_cookie

# Timezone for Ireland
IRELAND_TZ = pytz.timezone('Etc/GMT-1')

router = APIRouter(prefix="/admin", tags=["admin"])

"""
The secret key for admin registration 
"""
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")


# ================== Admin Register ==================
@router.post("/register", response_model=schemas.User)
def admin_register(admin: schemas.AdminCreate, db: Session = Depends(get_db), request: Request = None):

    # Check secret key 
    if admin.admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
     # Check the user name 
    existing_email = (
        db.query(models.User)
        .filter(models.User.email == normalized_email)
        .first()
    )
    if existing_email:
        raise HTTPException(status_code=400, detail="Username already taken.")

    normalized_email = (admin.email or "").strip().lower() or None

    if normalized_email:
        existing_email = db.query(models.User).filter(models.User.email == normalized_email)
        if existing_email:
            raise HTTPException(status_code=400, detail="Email is already in use.")

    # Hash the password
    hashed_pass = hash_password(admin.password)

    new_user = models.User(
        username=admin.username,
        email=admin.email,
        password=hashed_pass,
        role = 'admin',  # Mark this user as admin
        discord_id=admin.discord_id,
        status="active",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Store the user_id in Session
    session_id = create_user_session(db, new_user.id, request)
    response = JSONResponse({
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "role": new_user.role,
        "status": new_user.status,
    })
    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=3600 * 24 * 7,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return response

# ================== Admin Login ==================
@router.post("/login")
def login_user(login_data: schemas.UserLogin, db: Session = Depends(get_db), request: Request = None):
    
    user = db.query(models.User).filter(models.User.username == login_data.username).first()

    # Check if the user exists and required information is correct
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    # Check if user account is active
    if (user.status or "").lower() != "active":
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    session_id = create_user_session(db, user.id, request)
    response = JSONResponse({
        "message": "Sign in successful",
        "user_id": user.id,
        "role": user.role,
    })
    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=3600 * 24 * 7,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return response

@router.post("/logout")
def admin_logout(request: Request, db: Session = Depends(get_db)):
    revoke_session_by_cookie(db, request)
    response = JSONResponse({"message": "Signed out successfully"})
    response.delete_cookie("session_id", path="/", samesite="lax", secure=False, httponly=True)
    return response


# ================== Admin Check ==================
def admin_required(request: Request, db: Session = Depends(get_db)):

    user = get_user_from_session_cookie(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not user:
        raise HTTPException(status=403, detail="Admin privileges required")
    if (user.status or "").lower() != "active":
        raise HTTPException(status=403, detail="Account is inactive")
    if (user.role or "").lower() not in {"admin", "super admin"}:
        raise HTTPException(status=403, detail="Admin privileges required")

def super_admin_required(request: Request, db: Session = Depends(get_db)):
    user = get_user_from_session_cookie(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not user:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    if (user.status or "").lower() != "active":
        raise HTTPException(status_code=403, detail="Account is inactive")
    if (user.role or "").lower() != "super admin":
        raise HTTPException(status_code=403, detail="Super admin privileges required")


def _get_group_discord_targets(db: Session, grouped_booking_id: str) -> set[str]:
    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == grouped_booking_id)
        .all()
    )
    target_ids = set()
    for booking in bookings:
        if booking.user and booking.user.discord_id:
            target_ids.add(booking.user.discord_id)
    return target_ids


def _build_booking_status_message(db: Session, grouped_booking_id: str, status: str, discord_id: str) -> str:
    bookings = (
        db.query(models.Booking)
        .join(models.User)
        .join(models.Device)
        .filter(
            models.Booking.grouped_booking_id == grouped_booking_id,
            models.User.discord_id == discord_id
        )
        .all()
    )
    if not bookings:
        return ""

    # Group bookings by device and find overall time range for each device
    device_ranges = {}
    for b in bookings:
        device_key = (b.device.deviceType, b.device.deviceName)
        if device_key not in device_ranges:
            device_ranges[device_key] = {'start': b.start_time, 'end': b.end_time}
        else:
            device_ranges[device_key]['start'] = min(device_ranges[device_key]['start'], b.start_time)
            device_ranges[device_key]['end'] = max(device_ranges[device_key]['end'], b.end_time)

    devices_info = []
    for (device_type, device_name), times in device_ranges.items():
        start_str = times['start'].strftime("%Y-%m-%d %H:%M")
        end_str = times['end'].strftime("%Y-%m-%d %H:%M")
        devices_info.append(
            f"> Device: **{device_type} - {device_name}**\n"
            f"> Time Period: {start_str} ~ {end_str}"
        )
    devices_str = "\n".join(devices_info)

    # Check if this is a collaborative booking and gather collaborator info
    collab_info = ""
    all_group_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == grouped_booking_id)
        .all()
    )
    if len(all_group_bookings) > 1:
        # This is a collaborative booking - gather all usernames in the group
        collaborator_users = set()
        for b in all_group_bookings:
            if b.user and b.user.username:
                collaborator_users.add(b.user.username)
        # Remove the current user from the list to show only "other" collaborators
        current_user = next((b.user.username for b in all_group_bookings if b.user and b.user.discord_id == discord_id), None)
        if current_user:
            collaborator_users.discard(current_user)
        
        if collaborator_users:
            collab_str = ", ".join(sorted(collaborator_users))
            collab_info = f"> **Collaborative booking with:** {collab_str}\n"

    if status.upper() == "CONFIRMED":
        return (
            f":white_check_mark: <@{discord_id}>, your booking has been **CONFIRMED** by admin.\n"
            f"{collab_info}{devices_str}"
        )
    elif status.upper() == "REJECTED":
        return (
            f":x: <@{discord_id}>, your booking has been **REJECTED** by admin.\n"
            f"{collab_info}{devices_str}"
        )
    elif status.upper() == "DECLINED":
        return (
            f":x: <@{discord_id}>, your booking has been **DECLINED** by admin.\n"
            f"{collab_info}{devices_str}"
        )
    else:
        return (
            f":information_source: <@{discord_id}>, your booking status has been updated to **{status.upper()}**.\n"
            f"{collab_info}{devices_str}"
        )


def _notify_group_booking_status(
    db: Session,
    booking: models.Booking,
    status: str,
    background_tasks: BackgroundTasks,
) -> None:
    target_discord_ids = _get_group_discord_targets(db, booking.grouped_booking_id)
    if not target_discord_ids:
        return

    for discord_id in target_discord_ids:
        message = _build_booking_status_message(db, booking.grouped_booking_id, status, discord_id)
        if message:
            background_tasks.add_task(send_admin_action_notification, message, discord_id)


@router.get("/checkAdminSession")
def get_session(request: Request, db: Session = Depends(get_db)):

    user = get_user_from_session_cookie(db, request)
    if user:
        return {"logged_in": True, "user_id": user.id, "username": user.username, "role": user.role}
    return {"logged_in": False}



# ================== Show all devices ==================
@router.get("/devices", response_model=list[schemas.DeviceResponse])
def get_devices(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    # Phase U2: Eager load device_type to prevent N+1 queries
    return db.query(models.Device).all()



# ================== Add a new device ==================
@router.post("/devices", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def add_device(device: schemas.DeviceCreate, db: Session = Depends(get_db), auth: None = Depends(admin_required)):

    # Phase U2: Rewrite deviceType filter with JOIN
    existing_polatis = (
        db.query(Device)
        .join(DeviceType)
        .filter(
            DeviceType.name == device.deviceType,
            Device.name == device.deviceName,
            Device.polatis_name == device.polatis_name
        )
        .first()
    )

    if existing_polatis:
        raise HTTPException(status_code=400, detail="Polatis name already exists in this device group")

    # Phase U2: Rewrite IP conflict check with JOIN
    if device.ip_address:
        existing_ip_conflict = (
            db.query(Device)
            .join(DeviceType)
            .filter(
                Device.mgmt_ip == str(device.ip_address),
                or_(
                    DeviceType.name != device.deviceType,
                    Device.name != device.deviceName
                )
            )
            .first()
        )

        if existing_ip_conflict:
            raise HTTPException(status_code=400, detail="IP address already exists for another device")

    # Phase U2: Create InventoryDevice with device_type lookup
    # deviceType setter was removed - must handle lookup in router
    device_type_obj = db.query(DeviceType).filter(DeviceType.name == device.deviceType).first()
    if not device_type_obj:
        raise HTTPException(
            status_code=400,
            detail=f"DeviceType '{device.deviceType}' not found. Please create it via inventory API first."
        )
    
    new_device = Device(
        polatis_name=device.polatis_name,
        device_type=device_type_obj,  # Set relationship directly
        deviceName=device.deviceName,
        status=device.status,
        ip_address=str(device.ip_address) if device.ip_address else None,
        maintenance_start=device.maintenance_start,  
        maintenance_end=device.maintenance_end,
        Out_Port=device.Out_Port,
        In_Port=device.In_Port   
    )
    db.add(new_device)
    db.commit()
    # Eager load device_type for response
    db.refresh(new_device)
    return new_device



# ================== Delete a device ==================
@router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db),  auth: None = Depends(admin_required)):

    device = db.query(Device).get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"success": True, "message": f"Device {device_id} deleted successfully"}


# ================== Edit a device ==================
@router.put("/devices/{device_id}", response_model = schemas.DeviceResponse)
def update_device_info(device_id: int, update: schemas.DeviceUpdateFull, 
                       db: Session = Depends(get_db), auth: None = Depends(admin_required)):

    # Phase U2: Query with eager loading
    device = db.query(Device).options(joinedload(Device.device_type)).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    old_type = device.deviceType
    old_name = device.deviceName
     
    # Phase U2: Check if polatis exists with JOIN
    existing_polatis = (
        db.query(Device)
        .join(DeviceType)
        .filter(
            Device.id != device_id,
            DeviceType.name == update.deviceType,
            Device.name == update.deviceName,
            Device.polatis_name == update.polatis_name
        )
        .first()
    )

    if existing_polatis:
        raise HTTPException(status_code=400, detail="Polatis name already exists in this device group")

    # Phase U2: Check IP conflict with JOIN
    if update.ip_address:
        existing_ip_conflict = (
            db.query(Device)
            .join(DeviceType)
            .filter(
                Device.id != device_id,
                Device.mgmt_ip == str(update.ip_address),
                or_(
                    DeviceType.name != update.deviceType,
                    Device.name != update.deviceName,
                )
            )
            .first()
        )

        if existing_ip_conflict:
            raise HTTPException(status_code=400, detail="IP address already exists for another device")

    # Phase U2: Bulk update with JOIN (update all devices with same type/name)
    # SQLAlchemy does not allow bulk update on a query with JOINs.
    # Update in memory instead to keep behavior consistent.
    same_group_devices = (
        db.query(Device)
        .join(DeviceType)
        .filter(
            DeviceType.name == old_type,
            Device.name == old_name
        )
        .all()
    )
    new_ip = str(update.ip_address) if update.ip_address else None
    for dev in same_group_devices:
        dev.mgmt_ip = new_ip
    
    # Update device properties
    # deviceType setter was removed - must handle lookup in router
    if update.deviceType != device.deviceType:
        new_device_type = db.query(DeviceType).filter(DeviceType.name == update.deviceType).first()
        if not new_device_type:
            raise HTTPException(
                status_code=400,
                detail=f"DeviceType '{update.deviceType}' not found. Please create it via inventory API first."
            )
        device.device_type = new_device_type
    
    device.status = update.status
    device.deviceName = update.deviceName
    device.maintenance_start = update.maintenance_start
    device.maintenance_end = update.maintenance_end  
    device.Out_Port = update.Out_Port  
    device.In_Port = update.In_Port 
    
    db.commit()
    db.refresh(device)
    return device

# ================== Get all pending or conflicting bookings ==================
@router.get("/bookings/pending")
def get_pending_bookings(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    bookings = (
        db.query(models.Booking)
        .join(models.User)
        .join(models.Device)
        .filter(models.Booking.status.in_(["PENDING", "CONFLICTING"]))
        .all()
    )

    return [{
        "booking_id": b.booking_id,
        "user_id": b.user_id,
        "username": b.user.username,
        "device_type": b.device.deviceType,
        "device_name": b.device.deviceName,
        "ip_address": b.device.ip_address,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status,
        "comment": b.comment
    } for b in bookings]


# ================== Confirm or Reject bookings & Send Emails ==================
@router.put("/bookings/{booking_id}")
async def update_booking_status(
    booking_id: int,
    status_update: schemas.BookingStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: None = Depends(admin_required)
):
    valid_statuses = ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {', '.join(valid_statuses)}")
    
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    db.query(models.Booking).filter(
        models.Booking.grouped_booking_id == booking.grouped_booking_id
    ).update(
        {
            models.Booking.status: status_update.status,
            models.Booking.status_updated_at: datetime.now(IRELAND_TZ).replace(tzinfo=None),
        },
        synchronize_session=False,
    )
    db.commit()

    # Check if the group has collaborators (more than 1 booking)
    booking_count = db.query(models.Booking).filter(
        models.Booking.grouped_booking_id == booking.grouped_booking_id
    ).count()
    if status_update.status in ["CONFIRMED", "REJECTED"] or booking_count > 1:
        _notify_group_booking_status(db, booking, status_update.status, background_tasks)


# ================== Show all current bookings ==================
@router.get("/bookings/all")
def get_all_bookings(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    bookings = (
        db.query(models.Booking)
        .join(models.User)
        .join(models.Device)
        .order_by(models.Booking.start_time.desc())  # sort in the default start time 
        .all()
    )

    return [{
        "booking_id": b.booking_id,
        "user_id": b.user_id,
        "username": b.user.username,
        "device_type": b.device.deviceType,
        "device_name": b.device.deviceName,
        "ip_address": b.device.ip_address,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status,
        "comment": b.comment
    } for b in bookings]    
