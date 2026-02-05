"""
Tests for device management endpoints (admin only)
"""
import pytest
from backend.inventory.models import DeviceType, InventoryDevice


def _ensure_device_type(db_session, name):
    existing = db_session.query(DeviceType).filter(DeviceType.name == name).first()
    if existing:
        return existing
    device_type = DeviceType(
        name=name,
        category="OPTICAL",
        description=f"{name} devices",
        is_schedulable=True,
        has_ports=True,
    )
    db_session.add(device_type)
    db_session.commit()
    db_session.refresh(device_type)
    return device_type


def test_get_all_devices(authenticated_admin_client, db_session):
    """Test getting all devices (admin only)"""
    # Ensure an inventory device exists (admin router uses InventoryDevice)
    _ensure_device_type(db_session, "Router")
    inventory_device = InventoryDevice(
        name="Router1",
        device_type_id=_ensure_device_type(db_session, "Router").id,
        status="Available",
        mgmt_ip="192.168.1.1",
    )
    db_session.add(inventory_device)
    db_session.commit()

    response = authenticated_admin_client.get("/admin/devices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_devices_requires_admin(authenticated_client):
    """Test that non-admin users cannot access device list"""
    response = authenticated_client.get("/admin/devices")
    assert response.status_code == 403


def test_add_device(authenticated_admin_client, db_session):
    """Test adding a new device"""
    # Ensure DeviceType exists for admin endpoint
    _ensure_device_type(db_session, "Router")

    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "Router",
            "deviceName": "NewRouter",
            "ip_address": "192.168.1.100",
            "status": "Available",
            "Out_Port": 10,
            "In_Port": 20
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["deviceType"] == "Router"
    assert data["deviceName"] == "NewRouter"
    assert data["ip_address"] == "192.168.1.100"


def test_add_device_with_maintenance(authenticated_admin_client, db_session):
    """Test adding device with maintenance period"""
    from datetime import datetime, timedelta
    tomorrow = datetime.now() + timedelta(days=1)

    _ensure_device_type(db_session, "Switch")
    
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "Switch",
            "deviceName": "Switch1",
            "ip_address": "192.168.1.101",
            "status": "Maintenance",
            "maintenance_start": f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}",
            "maintenance_end": f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}",
            "Out_Port": 11,
            "In_Port": 21
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Maintenance"
    assert data["maintenance_start"] is not None


def test_add_device_duplicate_ip(authenticated_admin_client, db_session):
    """Test adding device with duplicate IP address"""
    # Create base device type and existing inventory device
    router_type = _ensure_device_type(db_session, "Router")
    _ensure_device_type(db_session, "DifferentType")
    existing = InventoryDevice(
        name="Router1",
        device_type_id=router_type.id,
        status="Available",
        mgmt_ip="192.168.1.100",
    )
    db_session.add(existing)
    db_session.commit()

    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "DifferentType",
            "deviceName": "DifferentName",
            "ip_address": "192.168.1.100",  # Same IP
            "status": "Available",
            "Out_Port": 12,
            "In_Port": 22
        }
    )
    assert response.status_code == 400
    assert "ip" in response.json()["detail"].lower() or "address" in response.json()["detail"].lower()


def test_update_device(authenticated_admin_client, db_session):
    """Test updating device information"""
    router_type = _ensure_device_type(db_session, "Router")
    inventory_device = InventoryDevice(
        name="Router1",
        device_type_id=router_type.id,
        status="Available",
        mgmt_ip="192.168.1.110",
    )
    db_session.add(inventory_device)
    db_session.commit()

    response = authenticated_admin_client.put(
        f"/admin/devices/{inventory_device.id}",
        json={
            "deviceType": "Router",
            "deviceName": "Router1",
            "ip_address": "192.168.1.200",
            "status": "Maintenance",
            "Out_Port": 1,
            "In_Port": 2
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ip_address"] == "192.168.1.200"
    assert data["status"] == "Maintenance"


def test_update_device_nonexistent(authenticated_admin_client):
    """Test updating non-existent device"""
    response = authenticated_admin_client.put(
        "/admin/devices/99999",
        json={
            "deviceType": "Router",
            "deviceName": "Router1",
            "status": "Available",
            "Out_Port": 1,
            "In_Port": 2
        }
    )
    assert response.status_code == 404


def test_delete_device(authenticated_admin_client, db_session):
    """Test deleting a device"""
    router_type = _ensure_device_type(db_session, "Router")
    inventory_device = InventoryDevice(
        name="Router1",
        device_type_id=router_type.id,
        status="Available",
        mgmt_ip="192.168.1.120",
    )
    db_session.add(inventory_device)
    db_session.commit()

    response = authenticated_admin_client.delete(f"/admin/devices/{inventory_device.id}")
    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()


def test_delete_device_nonexistent(authenticated_admin_client):
    """Test deleting non-existent device"""
    response = authenticated_admin_client.delete("/admin/devices/99999")
    assert response.status_code == 404


def test_delete_device_requires_admin(authenticated_client):
    """Test that non-admin users cannot delete devices"""
    response = authenticated_client.delete("/admin/devices/1")
    assert response.status_code == 403


def test_add_device_with_polatis_name(authenticated_admin_client, db_session):
    """Test adding device with Polatis name"""
    _ensure_device_type(db_session, "Router")

    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "polatis_name": "POLATIS_001",
            "deviceType": "Router",
            "deviceName": "RouterWithPolatis",
            "ip_address": "192.168.1.102",
            "status": "Available",
            "Out_Port": 13,
            "In_Port": 23
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["polatis_name"] == "POLATIS_001"


def test_add_device_duplicate_polatis_name(authenticated_admin_client, db_session):
    """Test adding device with duplicate Polatis name in same device group"""
    # Create first device
    device_type = _ensure_device_type(db_session, "Router")
    device1 = InventoryDevice(
        polatis_name="POLATIS_DUP",
        name="Router1",
        device_type_id=device_type.id,
        status="Available",
        mgmt_ip="192.168.1.55",
    )
    db_session.add(device1)
    db_session.commit()
    
    # Try to add another with same Polatis name in same group
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "polatis_name": "POLATIS_DUP",
            "deviceType": "Router",
            "deviceName": "Router1",
            "status": "Available",
            "Out_Port": 14,
            "In_Port": 24
        }
    )
    assert response.status_code == 400
    assert "polatis" in response.json()["detail"].lower()
