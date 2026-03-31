import os
import pytest

@pytest.mark.asyncio
@pytest.mark.integration
async def test_fetch_bookings_integration():
    if os.getenv("RUN_MCP_INTEGRATION") != "1":
        pytest.skip("Set RUN_MCP_INTEGRATION=1 to run integratio tests")
    
    result = await fetch_bookings(FetchBookingsInput(status="PENDING", limit=5))

    assert isinstance(result["items"], list)
    assert isinstance(result["meta"], dict)
    assert "total" in result["meta"]