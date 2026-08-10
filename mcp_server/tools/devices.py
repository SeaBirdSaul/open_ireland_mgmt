from pydantic import BaseModel, Field

class FetchDevicesInput(BaseModel):
    status: str | None = None
    # owner_id: int | None = None
    # tag: str | None = None
    # search: str | None = None

class UpdateDeviceStatusInput(BaseModel):
    device_ids: list[int]
    status: str

class FetchDeviceDetailInput(BaseModel):
    device_id: int


def register(mcp, client_factory):
    @mcp.tool()
    async def fetch_devices(input: FetchDevicesInput) -> dict:
        client = client_factory()
        return await client.fetch_devices(input.model_dump(exclude_none=True))

    @mcp.tool()
    async def fetch_device_details(input: FetchDeviceDetailInput) -> dict:
        client = client_factory()
        return await client.fetch_device_details(input.device_id)

    @mcp.tool()
    async def update_device_status(input: UpdateDeviceStatusInput) -> dict:
        client = client_factory()
        return await client.update_device_status(input.model_dump(exclude_none=True))
    
    