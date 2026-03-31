from pydantic import BaseModel, Field
from typing import Any
from backend.scheduler.schemas import AdminRoleType, AdminStatus

class ListUserInput(BaseModel):
    role: str | None = None
    status: str | None = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)

class InviteUserInput(BaseModel):
    email: str
    handle: str | None = None
    role: AdminRoleType
    firstName: str = Field(min_length=1, max_length=50)
    lastName: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    notes: str | None = Field(default=None, max_length=4000)

class ListInvitesInput(BaseModel):
    status: str | None = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)

class ApproveInvitationInput(BaseModel):
    invitation_id: int = Field(gt=0)

class RejectInvitationInput(BaseModel):
    invitation_id: int = Field(gt=0)
    reason: str | None = None 

class UpdateUserRoleInput(BaseModel):
    user_id: int = Field(gt=0)
    role: AdminRoleType
    approval_limits: dict[str, Any] | None = None

class UpdateUserStatusInput(BaseModel):
    user_id: int = Field(gt=0)
    status: AdminStatus

def register(mcp, client_factory):
    @mcp.tool()
    async def list_users(input: ListUserInput) -> dict:
        client = client_factory()
        return await client.list_users(input.model_dump(exclude_none=True))

    @mcp.tool()
    async def invite_user(input: InviteUserInput) -> dict:
        client = client_factory()
        return await client.invite_user(input.model_dump(exclude_none=True))

    @mcp.tool()
    async def list_invites(input: ListInvitesInput) -> dict:
        client = client_factory()
        return await client.list_invites(input.model_dump(exclude_none=True))
    
    @mcp.tool()
    async def approve_invite(input: ApproveInvitationInput) -> dict:
        client = client_factory()
        payload = input.model_dump(exclude_none=True)
        invitation_id = payload.pop("invitation_id")
        return await client.approve_invitation(invitation_id)

    @mcp.tool()
    async def reject_invite(input: RejectInvitationInput) -> dict:
        client = client_factory()
        payload = input.model_dump(exclude_none=True)
        invitation_id = payload.pop("invitation_id")
        return await client.reject_invitation(invitation_id, payload)

    @mcp.tool()
    async def update_user_role(input: UpdateUserRoleInput) -> dict:
        client = client_factory()
        payload = input.model_dump(exclude_none=True)
        user_id = payload.pop("user_id")
        return await client.update_user_role(user_id, payload)

    @mcp.tool()
    async def update_user_status(input: UpdateUserStatusInput) -> dict:
        client = client_factory()
        payload = input.model_dump(exclude_none=True)
        user_id = payload.pop("user_id")
        return await client.update_user_status(user_id, payload)
    
        