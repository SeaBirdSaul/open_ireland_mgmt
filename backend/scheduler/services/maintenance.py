from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable
from sqlalchemy.orm import Session, joinedload
import pytz
from backend.scheduler import models

# Timezone for Ireland
IRELAND_TZ = pytz.timezone('Etc/GMT-1')

ACTIVE_BOOKING_STATUSES = {"PENDING", "CONFIRMED", "CONFLICTING"}
TERMINAL_BOOKING_STATUSES = {"DECLINED", "CANCELLED", "EXPIRED"}
MAINTENANCE_DECLINE_COMMENT = "Declined due to device maintenance."

@dataclass
class MaintenanceNotification:
    user_id: int
    discord_id: str | None
    booking_id: int
    message: str

@dataclass
class MaintenanceImpactResult:
    devices_updated: list[int]
    affected_booking_ids: list[int]
    affected_count: int
    notifications: list[MaintenanceNotification]

_TIME_SEGMENTS: dict[str, tuple[int, int]] = {
    "7 AM - 12 PM": (7, 12),
    "12 PM - 6 PM": (12, 18),
    "6 PM - 11 PM": (18, 23)
}

def _parse_maintenance_marker(value: str | None, *, is_end: bool) -> datetime | None:
    if not value:
        return None
    
    try:
        segment, date_str = value.split("/", 1)
        day = datetime.strptime(date_str, "%Y-%m-%d")
    
        if segment == "All Day":
            if is_end:
                return day + timedelta(days = 1)
            return day
        
        start_hour, end_hour = _TIME_SEGMENTS[segment]
        hour = end_hour if is_end else start_hour
        return day.replace(hour=hour, minute=0, second=0, microsecond=0)
    except (ValueError, KeyError):
        return None
    
def maintenance_window_from_strings(
    maintenance_start: str | None,
    maintenance_end: str | None,
) -> tuple[datetime | None, datetime | None]:
    return (
        _parse_maintenance_marker(maintenance_start, is_end=False),
        _parse_maintenance_marker(maintenance_end, is_end=True)
    )

def is_maintenance_window_valid(maintenance_start: str | None, maintenance_end: str | None) -> bool:
    window_start, window_end = maintenance_window_from_strings(maintenance_start, maintenance_end)
    return bool(window_start and window_end and window_end > window_start)

def is_maintenance_active_at(
    *,
    maintenance_start: str | None,
    maintenance_end: str | None,
    at: datetime | None = None,
) -> bool:
    check_at = at or datetime.now(IRELAND_TZ).replace(tzinfo=None)
    window_start, window_end = maintenance_window_from_strings(maintenance_start, maintenance_end)

    if not window_start or not window_end or window_end <= window_start:
        return False
    return window_start <= check_at < window_end

def has_maintenance_ended(
    *,
    maintenance_start: str | None,
    maintenance_end: str | None,
    at: datetime | None = None,
) -> bool:
    check_at = at or datetime.now(IRELAND_TZ).replace(tzinfo=None)
    _, window_end = maintenance_window_from_strings(maintenance_start, maintenance_end)
    if not window_end:
        return False
    return check_at >= window_end

def resolve_status_for_scheduled_maintenance(
    *,
    requested_status: str,
    previous_status: str | None,
    maintenance_start: str | None,
    maintenance_end: str | None,
    fallback_status: str = "Available",
    at: datetime | None = None,
) -> str:
    if requested_status != "Maintenance":
        return requested_status
    
    if not is_maintenance_window_valid(maintenance_start, maintenance_end):
        return "Maintenance"
    
    if is_maintenance_active_at(maintenance_start=maintenance_start, maintenance_end=maintenance_end, at=at):
        return "Maintenance"
    
    if previous_status == "Maintenance":
        return fallback_status
    
    return previous_status or fallback_status

def should_enter_maintenance(device: models.Device, *, at: datetime | None = None) -> bool:
    return device.status != "Maintenance" and is_maintenance_active_at(device, at=at)

def should_exit_maintenance(device: models.Device, *, at: datetime | None = None) -> bool:
    at = (at or datetime.now(IRELAND_TZ)).replace(tzinfo=None)
    _, window_end = maintenance_window_from_strings(device.maintenance_start, device.maintenance_end)
    return device.status == "Maintenance" and window_end is not None and at >= window_end


def device_is_entering_maintenance(previous_status: str | None, next_status: str | None) -> bool:
    return previous_status != "Maintenance" and next_status == "Maintenance"

def build_maintenance_booking_message(
    *,
    user: models.User,
    booking: models.Booking,
    device: models.Device,
) -> str:
    start_str = booking.start_time.strftime("%Y-%m-%d %H:%M")
    end_str = booking.end_time.strftime("%Y-%m-%d %H:%M")

    mention = f"<@{user.discord_id}>," if user.discord_id else "Your booking"
    return (
        f":warning: {mention} your booking was affected because the device entered maintenance.\n"
        f"> Device: **{device.deviceType} - {device.deviceName}**\n"
        f"> Time Period: {start_str} ~ {end_str}\n"
        f"> Booking ID: #{booking.booking_id}"
    )

def apply_maintenance_to_devices(
    db: Session,
    *,
    devices: Iterable[models.Device],
    decline_status: str = "DECLINED",
) -> MaintenanceImpactResult:
    device_list = list(devices)
    if not device_list:
        return MaintenanceImpactResult(
            devices_updated=[],
            affected_booking_ids=[],
            affected_count=0,
            notifications=[]
        )
    
    affected_bookings: dict[int, models.Booking] = {}
    notifications: list[MaintenanceNotification] = []

    for device in device_list:
        window_start, window_end = maintenance_window_from_strings(
            device.maintenance_start,
            device.maintenance_end
        )

        if not window_start or not window_end or window_end <= window_start:
            continue
        
        # print("MAINT DEBUG device", device.id, device.status, device.maintenance_start, device.maintenance_end)
        # print("MAINT DEBUG window", window_start, window_end)

        rows = (
            db.query(models.Booking)
            .filter(models.Booking.device_id == device.id)
            .filter(models.Booking.status.in_(ACTIVE_BOOKING_STATUSES))
            .filter(models.Booking.start_time < window_end)
            .filter(models.Booking.end_time > window_start)
            .all()
        )

        # print("MAINT DEBUG matched bookings", [b.booking_id for b in rows])

        for booking in rows:
            if booking.booking_id in affected_bookings:
                continue
            
            booking.status = decline_status
            booking.comment = MAINTENANCE_DECLINE_COMMENT
            booking.status_updated_at = datetime.now(IRELAND_TZ).replace(tzinfo=None)
            affected_bookings[booking.booking_id] = booking

            user = booking.user
            notifications.append(
                MaintenanceNotification(
                    user_id=user.id,
                    discord_id=user.discord_id,
                    booking_id=booking.booking_id,
                    message=build_maintenance_booking_message(
                        user=user,
                        booking=booking,
                        device=device,
                    ),
                )
            )
    return MaintenanceImpactResult(
        devices_updated=[device.id for device in device_list],
        affected_booking_ids=sorted(affected_bookings.keys()),
        affected_count=len(affected_bookings),
        notifications=notifications,
    )

def sync_scheduled_maintenance_statuses(db: Session, *, at: datetime | None = None, default_return_status: str = "Available") -> MaintenanceImpactResult:
    check_at = (at or datetime.now(IRELAND_TZ)).replace(tzinfo=None)
    
    rows = (
        db.query(models.Device)
        .filter(models.Device.maintenance_start.isnot(None))
        .filter(models.Device.maintenance_end.isnot(None))
        .all()
    )

    entering_devices: list[models.Device] = []
    devices_updated: list[int] = []

    for device in rows:
        window_start, window_end = maintenance_window_from_strings(device.maintenance_start, device.maintenance_end)

        if not window_start or not window_end or window_end <= window_start:
            continue
        
        if device.status != "Maintenance" and window_start <= check_at < window_end:
            device.status = "Maintenance"
            entering_devices.append(device)
            devices_updated.append(device.id)
            continue
        
        if device.status == "Maintenance" and check_at >= window_end:
            return_status = getattr(device, "maintenance_return_status", None) or default_return_status
            device.status = return_status
            device.maintenance_start = None
            device.maintenance_end = None
            if hasattr(device, "maintenance_return_status"):
                device.maintenance_return_status = None
            devices_updated.append(device.id)
        
    maintenance_result = apply_maintenance_to_devices(db, devices=entering_devices)

    return MaintenanceImpactResult(
        devices_updated=sorted(set(devices_updated)),
        affected_booking_ids=maintenance_result.affected_booking_ids,
        affected_count=maintenance_result.affected_count,
        notifications=maintenance_result.notifications,
    )