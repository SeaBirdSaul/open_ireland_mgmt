import httpx

class AdminV2Client:
    def __init__(self, base_url: str, session_cookie: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.session_cookie = session_cookie

    def _cookies(self) -> dict:
        if not self.session_cookie:
            return{}
        return {"session_id": self.session_cookie}
    
    async def _request(self, method: str, path: str, *, params: dict | None = None, json: dict | None = None) -> dict | None:
        async with httpx.AsyncClient(base_url=self.base_url, cookies=self._cookies()) as client:
            response = await client.request(method, path, params=params, json=json)
            response.raise_for_status()
            if not response.content:
                return None
            return response.json()

    async def fetch_bookings(self, params: dict) -> dict:
        return await self._request("GET", "/admin/v2/bookings", params=params)
        # cookies = {}
        # if self.session_cookie:
        #     cookies["session"] = self.session_cookie

        # async with httpx.AsyncClient(base_url=self.base_url, cookies=cookies) as client:
        #     response = await client.get("/admin/v2/bookings", params=params)
        #     response.raise_for_status()
        #     return response.json()
    
    async def approve_bookings(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/bookings/approve", json=payload)

    async def fetch_booking_detail(self, booking_id: int) -> dict:
        cookies = {}
        if self.session_cookie:
            cookies["session_id"] = self.session_cookie
        
        async with httpx.AsyncClient(base_url=self.base_url, cookies=cookies) as client:
            response = await client.get(f"/admin/v2/bookings/{booking_id}")
            response.raise_for_status()
            return response.json()
    
    async def decline_bookings(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/bookings/decline", json=payload)

    async def fetch_devices(self, params: dict) -> dict:
        return await self._request("GET", "/admin/v2/devices", params=params)

    async def fetch_device_details(self, device_id: int) -> dict:
        return await self._request("GET", f"/admin/v2/devices/{device_id}")
    
    async def update_device_status(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/devices/status", json=payload)

    async def update_device_owner(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/devices/assign-owner", json=payload)

    async def update_device_tags(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/devices/tags", json=payload)
    
    async def update_device_detail(self, device_id: int, payload: dict) -> dict:
        return await self._request("PUT", f"/admin/v2/devices/{device_id}", json=payload)
    
    async def list_users(self, params: dict) -> dict:
        return await self._request("GET", "/admin/v2/users", params=params)
    
    async def invite_user(self, payload: dict) -> dict:
        return await self._request("POST", "/admin/v2/users/invite", json=payload)
    
    async def list_invites(self, params: dict) -> dict:
        return await self._request("GET", "/admin/v2/invitations", params=params)
    
    async def approve_invitation(self, invitation_id: int) -> dict:
        return await self._request("POST", f"/admin/v2/invitations/{invitation_id}/approve")

    async def reject_invitation(self, invitation_id: int, payload: dict) -> dict:
        return await self._request("POST", f"/admin/v2/invitations/{invitation_id}/reject", json=payload)

    async def update_user_role(self, user_id: int, payload: dict) -> dict:
        return await self._request("POST", f"/admin/v2/users/{user_id}/role", json=payload)

    async def update_user_status(self, user_id: int, payload: dict) -> dict:
        return await self._request("POST", f"/admin/v2/users/{user_id}/status", json=payload)
    
    async def fetch_booking_group_detail(self, group_id: str, payload: dict) -> dict:
        return await self._request("GET", f"/admin/v2/bookings/group/${group_id}", json=payload)