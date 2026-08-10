import os
from pydantic import BaseModel, Field
from mcp.server.fastmcp import FastMCP
from mcp_server.tools import bookings, devices, user

from mcp_server.clients.admin_v2 import AdminV2Client

BACKEND_BASE_URL = os.getenv("MCP_BACKEND_BASE_URL", "http://localhost:25001")
BACKEND_SESSION_COOKIE = os.getenv("MCP_SESSION_COOKIE")

mcp = FastMCP("open-ireland-admin", stateless_http=True, json_response=True)

def client_factory():
    return AdminV2Client(
        base_url=BACKEND_BASE_URL,
        session_cookie=BACKEND_SESSION_COOKIE,
    )

bookings.register(mcp, client_factory)
devices.register(mcp, client_factory)
user.register(mcp, client_factory)