"""
Tests for scheduled maintenance start/end transitions.

These tests create their own temporary device and bookings so they do not
depend on the shared test_device fixture.
"""

from datetime import datetime, timedelta, UTC
import pytest

from backend.scheduler.models import Device, Booking
from backend.scheduler.services.maintenance import (
    is_maintenance_window_valid,
    is_maintenance_active_at,
    has_maintenance_ended,
    resolve_status_for_scheduled_maintenance,
    sync_scheduled_maintenance_statuses,
    MAINTENANCE_DECLINE_COMMENT
)

def _marker(segment: str, dt: datetime) -> str:
    return f"{segment}/{dt.strftime('%Y-%m-%d')}"

@pytest.fixture
def temp_maintenance_device(db_session):
    """
    Creates a disposable device for scheduled-maintenance tests.
    """
    device = Device(
        deviceType = "TestSwitch",
        deviceName = f"scheduled-maint-device-{int(datetime.now().timestamp() * 1000000)}",
        ip_address = None,
        maintenance_start = None,
        maintenance_end = None,
        maintenance_return_status = None,
        Out_Port = 101,
        In_Port = 202,
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)
    return device

@pytest.fixture
def temp_booking_on_device(db_session, test_user, temp_maintenance_device):
    """
    Creates a booking that can be overlapped by maintenance windows.
    """
    start_time = datetime.now() + timedelta(days = 1, hours = 1)
    end_time = start_time + timedelta(hours = 2)

    booking = Booking(
        device_id = temp_maintenance_device.id,
        user_id = test_user.id,
        start_time = start_time,
        end_time = end_time,
        status = "PENDING",
        comment = "temporary booking for maintenance tests"
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking

def test_maintenance_window_validation_accepts_valid_window():
    start = "12 PM - 6 PM/2026-04-10"
    end = "6 PM - 11 PM/2026-04-10"

    assert is_maintenance_window_valid(start, end) is True

def test_maintenance_window_validation_rejects_valid_window():
    end = "12 PM - 6 PM/2026-04-10"
    start = "6 PM - 11 PM/2026-04-10"

    assert is_maintenance_window_valid(start, end) is False

def test_resolve_status_for_future_maintenance_keeps_previous_status():
    now = datetime(2026, 4, 7, 9, 0, 0)

    resolved = resolve_status_for_scheduled_maintenance(
        requested_status = "Maintenance",
        previous_status = "Available",
        maintenance_start = "12 PM - 6 PM/2026-04-07",
        maintenance_end = "6 PM - 11 PM/2026-04-07",
        fallback_status = "Available",
        at = now
    )

    assert resolved == "Available"

def test_resolve_status_for_active_maintenance_returns_maintenance():
    now = datetime(2026, 4, 7, 13, 0, 0)

    resolved = resolve_status_for_scheduled_maintenance(
        requested_status = "Maintenance",
        previous_status = "Available",
        maintenance_start = "12 PM - 6 PM/2026-04-07",
        maintenance_end = "6 PM - 11 PM/2026-04-07",
        fallback_status = "Available",
        at = now
    )

    assert resolved == "Maintenance"

def test_is_maintenance_active_at_detects_active_window():
    assert is_maintenance_active_at(
        maintenance_start = "12 PM - 6 PM/2026-04-07",
        maintenance_end = "6 PM - 11 PM/2026-04-07",
        at = datetime(2026, 4, 7, 18, 30, 0)
    ) is True

def test_has_maintenance_ended_detects_end():
    assert has_maintenance_ended(
        maintenance_start = "12 PM - 6 PM/2026-04-07",
        maintenance_end = "6 PM - 11 PM/2026-04-07",
        at = datetime(2026, 4, 7, 23, 0, 0)
    ) is True

def test_sync_scheduled_maintenance_enters_window_and_declines_bookings(
    db_session,
    temp_maintenance_device,
    temp_booking_on_device
):
    """
    Device is scheduled for future maintenance, then sync runs inside the active window.
    Expected:
    - device status becomes Maintenance
    - overlapping booking is declined
    """

    booking = temp_booking_on_device
    device = temp_maintenance_device

    start_dt = booking.start_time.replace(minute=0, second=0, microsecond=0)
    end_dt = booking.end_time.replace(minute=0, second=0, microsecond=0)

    device.status = "Available"
    device.maintenance_start = _marker("12 PM - 6 PM", start_dt)
    device.maintenance_end = _marker("6 PM - 11 PM", end_dt)
    device.maintenance_return_status = "Available"
    db_session.commit()

    inside_window = booking.start_time + timedelta(minutes = 30)

    result = sync_scheduled_maintenance_statuses(
        db_session,
        at = inside_window.replace(tzinfo=None),
        default_return_status = "Available"
    )
    db_session.commit()
    db_session.refresh(device)
    db_session.refresh(booking)

    assert device.status == "Maintenance"
    assert booking.status == "DECLINED"
    assert booking.comment == MAINTENANCE_DECLINE_COMMENT
    assert booking.booking_id in result.affected_booking_ids
    assert device.id in result.devices_updated

def test_sync_scheduled_maintenance_does_not_activate_before_start(
    db_session,
    temp_maintenance_device
):
    """
    Maintenance scheduled for the future should not immediately flip the device status.
    """
    device = temp_maintenance_device
    device.status = "Available"
    device.maintenance_start = "12 PM - 6 PM/2026-04-10"
    device.maintenance_end = "6 PM - 11 PM/2026-04-10"
    device.maintenance_return_status = "Available"
    db_session.commit()

    before_start = datetime(2026, 4, 10, 11, 59, 0)

    result = sync_scheduled_maintenance_statuses(
        db_session,
        at = before_start,
        default_return_status = "Available"
    )
    db_session.commit()
    db_session.refresh(device)

    assert device.status == "Available"
    assert result.affected_booking_ids == []
    assert device.id not in result.devices_updated

def test_sync_scheduled_maintenance_exits_window_and_restores_previous_statsus(
    db_session,
    temp_maintenance_device
):
    """
    One the maintenance window has ended, deivce should restore to its return status and maintenance fields should be cleared.
    """
    device = temp_maintenance_device
    device.status = "Maintenance"
    device.maintenance_start = "12 PM - 6 PM/2026-04-10"
    device.maintenance_end = "6 PM - 11 PM/2026-04-10"
    device.maintenance_return_status = "Unavailable"
    db_session.commit()

    after_end = datetime(2026, 4, 10, 23, 1, 0)

    result = sync_scheduled_maintenance_statuses(
        db_session,
        at = after_end,
        default_return_status = "Available"
    )
    db_session.commit()
    db_session.refresh(device)

    assert device.status == "Unavailable"
    assert device.maintenance_start is None
    assert device.maintenance_end is None
    assert device.maintenance_return_status is None
    assert device.id in result.devices_updated

def test_sync_scheduled_maintenance_uses_default_return_status_when_missing(
    db_session,
    temp_maintenance_device
):
    """
    If maintenance_return_status is missing, the sync should fall back to the provided default.
    """
    device = temp_maintenance_device
    device.status = "Maintenance"
    device.maintenance_start = "12 PM - 6 PM/2026-04-10"
    device.maintenance_end = "6 PM - 11 PM/2026-04-10"
    device.maintenance_return_status = None
    db_session.commit()

    after_end = datetime(2026, 4, 10, 23, 5, 0)

    sync_scheduled_maintenance_statuses(
        db_session, 
        at = after_end,
        default_return_status = "Available"
    )
    db_session.commit()
    db_session.refresh(device)

    assert device.status == "Available"