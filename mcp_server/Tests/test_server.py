import pytest
from unittest.mock import AsyncMock, Mock
from types import SimpleNamespace

from mcp_server.tools.bookings import (
    ApproveBookingsInput,
    DeclineBookingsInput,
    FetchBookingDetailInput,
    FetchBookingsInput,
    register as register_bookings,
)
from mcp_server.tools.devices import (
    FetchDeviceDetailInput,
    FetchDevicesInput,
    UpdateDeviceStatusInput,
    register as register_devices,
)
from mcp_server.tools.user import (
    ApproveInvitationInput,
    InviteUserInput,
    ListInvitesInput,
    ListUserInput,
    RejectInvitationInput,
    UpdateUserRoleInput,
    UpdateUserStatusInput,
    register as register_user,
)

class FakeMCP:
    def __init__(self):
        self.tools = {}
    
    def tool(self):
        def decorator(fn):
            self.tools[fn.__name__] = fn
            return fn
        return decorator

@pytest.mark.asyncio
async def test_register_exposes_fetch_bookings_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {
        "items": [{"booking_id": 7, "status": "PENDING"}],
        "meta": {"total": 1, "limit": 5, "offset": 0},
    }
    mock_client = SimpleNamespace(
        fetch_bookings = AsyncMock(return_value=mock_result)
    )
    client_factory = Mock(return_value=mock_client)

    register_bookings(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["fetch_bookings"]
    payload = FetchBookingsInput(status = "PENDING", limit = 5)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.fetch_bookings.assert_awaited_once_with(
        {
            "status": "PENDING",
            "conflict_only": False,
            "limit": 5,
            "offset": 0,
            "sort_by": "start_time",
            "sort_order": "asc",
        }
    )
    assert result == mock_result

@pytest.mark.asyncio
async def test_register_exposes_fetch_booking_detail_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"booking_id": 42, "status": "PENDING"}
    mock_client = SimpleNamespace(
        fetch_booking_detail = AsyncMock(return_value=mock_result)
    )
    client_factory = Mock(return_value=mock_client)

    register_bookings(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["fetch_booking_detail"]
    payload = FetchBookingDetailInput(booking_id=42)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.fetch_booking_detail.assert_awaited_once_with(42)
    assert result == mock_result

@pytest.mark.asyncio
async def test_register_exposes_approve_bookings_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"status": "approved", "booking_ids": [1, 2]}
    mock_client = SimpleNamespace(
        approve_bookings=AsyncMock(return_value=mock_result)
    )
    client_factory = Mock(return_value=mock_client)

    register_bookings(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["approve_bookings"]
    payload = ApproveBookingsInput(booking_ids=[1, 2], note="approved")

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.approve_bookings.assert_awaited_once_with(
        {"booking_ids": [1, 2], "note": "approved"}
    )
    assert result == mock_result

@pytest.mark.asyncio
async def test_register_exposes_decline_bookings_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"status": "declined", "booking_ids": [1, 2]}
    mock_client = SimpleNamespace(
        decline_bookings=AsyncMock(return_value=mock_result)
    )
    client_factory = Mock(return_value=mock_client)

    register_bookings(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["decline_bookings"]
    payload = DeclineBookingsInput(booking_ids=[1, 2])

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.decline_bookings.assert_awaited_once_with(
        {"booking_ids": [1, 2]}
    )
    assert result == mock_result



@pytest.mark.asyncio
async def test_register_exposes_fetch_devices_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"items": [], "meta": {"total": 0}}
    mock_client = SimpleNamespace(fetch_devices=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_devices(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["fetch_devices"]
    payload = FetchDevicesInput(status="Available")

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.fetch_devices.assert_awaited_once_with({"status": "Available"})
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_fetch_device_details_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"id": 9}
    mock_client = SimpleNamespace(fetch_device_details=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_devices(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["fetch_device_details"]
    payload = FetchDeviceDetailInput(device_id=9)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.fetch_device_details.assert_awaited_once_with(9)
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_update_device_status_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"status": "ok"}
    mock_client = SimpleNamespace(update_device_status=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_devices(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["update_device_status"]
    payload = UpdateDeviceStatusInput(device_ids=[1, 2], status="Maintenance")

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.update_device_status.assert_awaited_once_with(
        {"device_ids": [1, 2], "status": "Maintenance"}
    )
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_list_users_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"items": [], "meta": {"total": 0}}
    mock_client = SimpleNamespace(list_users=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["list_users"]
    payload = ListUserInput(role="admin", limit=10)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.list_users.assert_awaited_once_with(
        {"role": "admin", "limit": 10, "offset": 0}
    )
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_invite_user_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"id": 1, "email": "user@example.com"}
    mock_client = SimpleNamespace(invite_user=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["invite_user"]
    payload = InviteUserInput(
        email="user@example.com",
        role="admin",
        firstName="Jane",
        lastName="Doe",
        password="strong-password",
    )

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.invite_user.assert_awaited_once()
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_list_invites_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"items": [], "meta": {"total": 0}}
    mock_client = SimpleNamespace(list_invites=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["list_invites"]
    payload = ListInvitesInput(status="pending", limit=5)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.list_invites.assert_awaited_once_with(
        {"status": "pending", "limit": 5, "offset": 0}
    )
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_approve_invite_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"invitation_id": 8, "status": "accepted"}
    mock_client = SimpleNamespace(approve_invitation=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["approve_invite"]
    payload = ApproveInvitationInput(invitation_id=8)

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.approve_invitation.assert_awaited_once_with(8)
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_reject_invite_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"invitation_id": 8, "status": "rejected"}
    mock_client = SimpleNamespace(reject_invitation=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["reject_invite"]
    payload = RejectInvitationInput(invitation_id=8, reason="duplicate")

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.reject_invitation.assert_awaited_once_with(8, {"reason": "duplicate"})
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_update_user_role_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"user_id": 4, "role": "admin"}
    mock_client = SimpleNamespace(update_user_role=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["update_user_role"]
    payload = UpdateUserRoleInput(user_id=4, role="admin", approval_limits={"max_days": 7})

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.update_user_role.assert_awaited_once_with(
        4,
        {"role": "admin", "approval_limits": {"max_days": 7}},
    )
    assert result == mock_result


@pytest.mark.asyncio
async def test_register_exposes_update_user_status_and_delegates_to_client():
    fake_mcp = FakeMCP()
    mock_result = {"user_id": 4, "status": "active"}
    mock_client = SimpleNamespace(update_user_status=AsyncMock(return_value=mock_result))
    client_factory = Mock(return_value=mock_client)

    register_user(fake_mcp, client_factory)

    tool_fn = fake_mcp.tools["update_user_status"]
    payload = UpdateUserStatusInput(user_id=4, status="active")

    result = await tool_fn(payload)

    client_factory.assert_called_once_with()
    mock_client.update_user_status.assert_awaited_once_with(
        4,
        {"status": "active"},
    )
    assert result == mock_result