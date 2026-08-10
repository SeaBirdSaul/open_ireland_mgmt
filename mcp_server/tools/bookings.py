from pydantic import BaseModel, Field

class FetchBookingsInput(BaseModel):
    date_start: str | None = None
    date_end: str | None = None
    status: str | None = None
    search: str | None = None
    conflict_only: bool = False
    device_type: str | None = None
    device_name: str | None = None
    username: str | None = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    sort_by: str = "start_time"
    sort_order: str = "asc"

class ApproveBookingsInput(BaseModel):
    booking_ids: list[int]
    note: str | None = None

class FetchBookingDetailInput(BaseModel):
    booking_id: int = Field(gt=0)

class DeclineBookingsInput(BaseModel):
    booking_ids: list[int]

class FetchBookingGroupDetailInput(BaseModel):
    group_id: str

def register(mcp, client_factory):
    @mcp.tool()
    async def fetch_bookings(input: FetchBookingsInput) -> dict:
        client = client_factory()
        return await client.fetch_bookings(input.model_dump(exclude_none=True))
    
    @mcp.tool()
    async def fetch_booking_detail(input: FetchBookingDetailInput) -> dict:
        client = client_factory()
        return await client.fetch_booking_detail(input.booking_id)

    @mcp.tool()
    async def approve_bookings(input: ApproveBookingsInput) -> dict:
        client = client_factory()
        return await client.approve_bookings(input.model_dump(exclude_none=True))

    @mcp.tool()
    async def decline_bookings(input: DeclineBookingsInput) -> dict:
        client = client_factory()
        return await client.decline_bookings(input.model_dump(exclude_none=True))
    
    @mcp.tool()
    async def fetch_booking_group_detail(input: FetchBookingGroupDetailInput) -> dict:
        client = client_factory()
        return await client.fetch_booking_group_detail(input.model_dump(exclude_none=True))