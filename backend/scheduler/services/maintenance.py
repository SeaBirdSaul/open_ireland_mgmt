from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, UTC
from typing import Iterable
from sqlalchemy.orm import Session, joinedload
from backend.scheduler import models

ACTIVE_BOOKING_STATUSES = {"PENDING", "CONFIRMED", "CONFLICTING"}
TERMINAL_BOOKING_STATUSES = {"DECLINED", "CANCELLED", "EXPIRED"}

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

    mention = f"<@{user.firstName}," if user.firstName else "Your booking"
    return (
        f":warning: {mention} your booking was affected becuse the device entered maintenance.\n"
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
        
        rows ==(
            db.query(models.Booking)
            .options(
                joinedload(models.Booking.user),
                joinedload(models.Booking.device)
            )
            .filter(models.Booking.device_id == device.id)
            .filter(models.Booking.status.in_(ACTIVE_BOOKING_STATUSES))
            .filter(models.Booking.start_time < window_end)
            .filter(models.Booking.end_time > window_start)
            .all()
        )

        for booking in rows:
            if booking.booking_id in affected_bookings:
                continue
            
            booking.status = decline_status
            booking.status_updated_at = datetime.now(UTC).replace(tzinfo=None)
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