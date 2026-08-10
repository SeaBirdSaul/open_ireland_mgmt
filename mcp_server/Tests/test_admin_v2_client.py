import pytest 
import respx
import httpx
import json

from mcp_server.clients.admin_v2 import AdminV2Client

@pytest.mark.asyncio
@respx.mock
async def test_fetch_bookings_forwards_params_and_returns_json():
    route = respx.get("http://localhost:25001/admin/v2/bookings").mock(
        return_value = httpx.Response(
            200,
            json = {
                "items": [
                    {
                        "booking_id": 1,
                        "status" : "PENDING",
                    }
                ],
                "meta": {
                    "total": 1,
                    "limit": 5,
                    "offset": 0,
                },
            },
        )
    )

    client = AdminV2Client(base_url="http://localhost:25001")

    result = await client.fetch_bookings({"status": "PENDING", "limit": 5})

    assert route.called
    request = route.calls[0].request
    assert request.url.params["status"] == "PENDING"
    assert request.url.params["limit"] == "5"
    assert result["items"][0]["booking_id"] == 1
    assert result["meta"]["total"] == 1

@pytest.mark.asyncio
@respx.mock
async def test_fetch_bookings_sends_session_cookie_when_present():
    route = respx.get("http://localhost:25001/admin/v2/bookings").mock(
        return_value = httpx.Response(200, json = {"items": [], "meta": {"total": 0}})
    )

    client = AdminV2Client(
        base_url="http://localhost:25001",
        session_cookie="abc123",
    )

    await client.fetch_bookings({"status": "PENDING"})

    assert route.called
    request = route.calls[0].request
    cookie_header = request.headers.get("cookie", "")
    assert "session_id=abc123" in cookie_header

@pytest.mark.asyncio
@respx.mock
async def test_fetch_bookings_raises_for_non_200_response():
    respx.get("http://localhost:25001/admin/v2/bookings").mock(
        return_value=httpx.Response(401, json={"detail": "Not authenticated"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")

    with pytest.raises(httpx.HTTPStatusError):
        await client.fetch_bookings({"status": "PENDING"})

@pytest.mark.asyncio
@respx.mock
async def test_approve_bookings_posts_json_and_returns_response():
    route = respx.post("http://localhost:25001/admin/v2/bookings/approve").mock(
        return_value = httpx.Response(
            200,
            json={
                "status": "approved",
                "booking_ids": [1, 2]
            },
        )
    )

    client = AdminV2Client(base_url="http://localhost:25001")

    payload = {
        "booking_ids": [1, 2],
        "note": "approved by admin"
    }

    result = await client.approve_bookings(payload)
    
    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/bookings/approve"
    assert json.loads(request.content) == payload
    assert result == {
        "status": "approved",
        "booking_ids": [1, 2]
    }

@pytest.mark.asyncio
@respx.mock
async def test_approve_bookings_raises_for_non_200_response():
    respx.post("http://localhost:25001/admin/v2/bookings/approve").mock(
        return_value=httpx.Response(400, json={"detail": "Invalid booking selection"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    
    with pytest.raises(httpx.HTTPStatusError):
        await client.approve_bookings({"booking_ids": [1, 2]})
    
@pytest.mark.asyncio
@respx.mock
async def test_decline_bookings_posts_json_and_returns_response():
    route = respx.post("http://localhost:25001/admin/v2/bookings/decline").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "declined",
                "booking_ids": [1, 2]
            }
        )
    )

    client = AdminV2Client(base_url="http://localhost:25001")

    payload = {
        "booking_ids": [1, 2],
        "note": "Declined by admin"
    }

    result = await client.decline_bookings(payload)
    
    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/bookings/decline"
    assert json.loads(request.content) == payload
    assert result == {
        "status": "declined",
        "booking_ids": [1, 2]
    }

@pytest.mark.asyncio
@respx.mock
async def test_decline_bookings_raises_for_non_200_response():
    respx.post("http://localhost:25001/admin/v2/bookings/decline").mock(
        return_value=httpx.Response(400, json={"detail": "Invalid booking selection"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    
    with pytest.raises(httpx.HTTPStatusError):
        await client.decline_bookings({"booking_ids": [1, 2]})


@pytest.mark.asyncio
@respx.mock
async def test_fetch_booking_detail_calls_expected_endpoint():
    route = respx.get("http://localhost:25001/admin/v2/bookings/42").mock(
        return_value=httpx.Response(200, json={"booking_id": 42, "status": "PENDING"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.fetch_booking_detail(42)

    assert route.called
    request = route.calls[0].request
    assert request.method == "GET"
    assert request.url.path == "/admin/v2/bookings/42"
    assert result["booking_id"] == 42


@pytest.mark.asyncio
@respx.mock
async def test_fetch_devices_calls_expected_endpoint():
    route = respx.get("http://localhost:25001/admin/v2/devices").mock(
        return_value=httpx.Response(200, json={"items": [], "meta": {"total": 0}})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.fetch_devices({"status": "Available"})

    assert route.called
    request = route.calls[0].request
    assert request.url.params["status"] == "Available"
    assert result["meta"]["total"] == 0


@pytest.mark.asyncio
@respx.mock
async def test_fetch_device_details_calls_expected_endpoint():
    route = respx.get("http://localhost:25001/admin/v2/devices/9").mock(
        return_value=httpx.Response(200, json={"id": 9, "status": "Available"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.fetch_device_details(9)

    assert route.called
    request = route.calls[0].request
    assert request.method == "GET"
    assert request.url.path == "/admin/v2/devices/9"
    assert result["id"] == 9


@pytest.mark.asyncio
@respx.mock
async def test_update_device_status_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/devices/status").mock(
        return_value=httpx.Response(200, json={"status": "ok"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"device_ids": [1, 2], "status": "Maintenance"}

    result = await client.update_device_status(payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert json.loads(request.content) == payload
    assert result == {"status": "ok"}


@pytest.mark.asyncio
@respx.mock
async def test_update_device_owner_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/devices/assign-owner").mock(
        return_value=httpx.Response(200, json={"status": "ok"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"device_ids": [1], "owner_id": 7}

    result = await client.update_device_owner(payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert json.loads(request.content) == payload
    assert result == {"status": "ok"}


@pytest.mark.asyncio
@respx.mock
async def test_update_device_tags_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/devices/tags").mock(
        return_value=httpx.Response(200, json={"status": "ok"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"device_ids": [1], "tags": ["lab", "shared"]}

    result = await client.update_device_tags(payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert json.loads(request.content) == payload
    assert result == {"status": "ok"}


@pytest.mark.asyncio
@respx.mock
async def test_update_device_detail_puts_json():
    route = respx.put("http://localhost:25001/admin/v2/devices/3").mock(
        return_value=httpx.Response(200, json={"id": 3, "status": "Available"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"status": "Available", "deviceName": "dut-3"}

    result = await client.update_device_detail(3, payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "PUT"
    assert request.url.path == "/admin/v2/devices/3"
    assert json.loads(request.content) == payload
    assert result["id"] == 3


@pytest.mark.asyncio
@respx.mock
async def test_list_users_calls_expected_endpoint():
    route = respx.get("http://localhost:25001/admin/v2/users").mock(
        return_value=httpx.Response(200, json={"items": [], "meta": {"total": 0}})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.list_users({"role": "admin", "limit": 10})

    assert route.called
    request = route.calls[0].request
    assert request.url.params["role"] == "admin"
    assert request.url.params["limit"] == "10"
    assert result["meta"]["total"] == 0


@pytest.mark.asyncio
@respx.mock
async def test_invite_user_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/users/invite").mock(
        return_value=httpx.Response(200, json={"id": 1, "email": "user@example.com"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {
        "email": "user@example.com",
        "role": "admin",
        "firstName": "Jane",
        "lastName": "Doe",
        "password": "strong-password",
    }

    result = await client.invite_user(payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert json.loads(request.content) == payload
    assert result["email"] == "user@example.com"


@pytest.mark.asyncio
@respx.mock
async def test_list_invites_calls_expected_endpoint():
    route = respx.get("http://localhost:25001/admin/v2/invitations").mock(
        return_value=httpx.Response(200, json={"items": [], "meta": {"total": 0}})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.list_invites({"status": "pending", "limit": 5})

    assert route.called
    request = route.calls[0].request
    assert request.url.params["status"] == "pending"
    assert request.url.params["limit"] == "5"
    assert result["meta"]["total"] == 0


@pytest.mark.asyncio
@respx.mock
async def test_approve_invitation_posts_to_expected_endpoint():
    route = respx.post("http://localhost:25001/admin/v2/invitations/8/approve").mock(
        return_value=httpx.Response(200, json={"invitation_id": 8, "status": "accepted"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    result = await client.approve_invitation(8)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/invitations/8/approve"
    assert result["invitation_id"] == 8


@pytest.mark.asyncio
@respx.mock
async def test_reject_invitation_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/invitations/8/reject").mock(
        return_value=httpx.Response(200, json={"invitation_id": 8, "status": "rejected"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"reason": "duplicate request"}

    result = await client.reject_invitation(8, payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/invitations/8/reject"
    assert json.loads(request.content) == payload
    assert result["status"] == "rejected"


@pytest.mark.asyncio
@respx.mock
async def test_update_user_role_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/users/4/role").mock(
        return_value=httpx.Response(200, json={"user_id": 4, "role": "admin"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"role": "admin", "approval_limits": {"max_days": 7}}

    result = await client.update_user_role(4, payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/users/4/role"
    assert json.loads(request.content) == payload
    assert result["role"] == "admin"


@pytest.mark.asyncio
@respx.mock
async def test_update_user_status_posts_json():
    route = respx.post("http://localhost:25001/admin/v2/users/4/status").mock(
        return_value=httpx.Response(200, json={"user_id": 4, "status": "active"})
    )

    client = AdminV2Client(base_url="http://localhost:25001")
    payload = {"status": "active"}

    result = await client.update_user_status(4, payload)

    assert route.called
    request = route.calls[0].request
    assert request.method == "POST"
    assert request.url.path == "/admin/v2/users/4/status"
    assert json.loads(request.content) == payload
    assert result["status"] == "active"