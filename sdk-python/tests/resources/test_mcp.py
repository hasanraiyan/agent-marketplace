import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
MCP = {
    "_id": "m1",
    "domain": "d1",
    "ownerType": "Project",
    "name": "Internship Board",
    "transport": "http",
    "url": "https://mcp.example.com",
    "authType": "none",
    "authMode": "owner",
    "hasApiKey": False,
    "isEnabled": True,
    "tools": [],
    "resources": [],
    "resourceTemplates": [],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/mcps").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MCP})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    mcp = client.mcps.create(
        {"name": "Internship Board", "transport": "http", "url": "https://mcp.example.com"}
    )
    assert mcp["_id"] == "m1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/mcps").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [MCP]})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.mcps.list() == [MCP]


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/mcps/m1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MCP})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.mcps.get("m1")["name"] == "Internship Board"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/mcps/m1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MCP})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.mcps.update("m1", {"isEnabled": False})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/mcps/m1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.mcps.delete("m1")
    assert route.called


@respx.mock
def test_test_connection():
    respx.post(f"{BASE_URL}/api/v1/developer/mcps/m1/test").mock(
        return_value=httpx.Response(
            200,
            json={"success": True, "data": {"tools": [], "resources": [], "resourceTemplates": []}},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.mcps.test_connection("m1")
    assert result["tools"] == []


@respx.mock
def test_read_resource_forwards_uri_query():
    route = respx.get(f"{BASE_URL}/api/v1/developer/mcps/m1/resource").mock(
        return_value=httpx.Response(
            200, json={"success": True, "data": {"text": "hi", "mimeType": "text/plain"}}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.mcps.read_resource("m1", "file:///a.txt")
    assert result["text"] == "hi"
    sent = route.calls.last.request
    assert sent.url.params["uri"] == "file:///a.txt"


@respx.mock
def test_call_tool_returns_dynamic_shape():
    route = respx.post(f"{BASE_URL}/api/v1/developer/mcps/m1/call-tool").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"anything": 1}})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.mcps.call_tool("m1", "search", {"query": "internships"})
    assert result == {"anything": 1}
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body == {"name": "search", "arguments": {"query": "internships"}}


@respx.mock
def test_oauth_get_owner_authorize_url():
    respx.get(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/owner/authorize").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"url": "https://auth"}})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.mcps.oauth.get_owner_authorize_url("m1")["url"] == "https://auth"


@respx.mock
def test_oauth_get_user_authorize_url_forwards_return_to():
    route = respx.get(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/user/authorize").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"url": "https://auth"}})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.mcps.oauth.get_user_authorize_url("m1", return_to="https://app.example.com/done")
    sent = route.calls.last.request
    assert sent.url.params["returnTo"] == "https://app.example.com/done"


@respx.mock
def test_oauth_get_user_connection_status():
    respx.get(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/user/status").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"connected": True}})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.mcps.oauth.get_user_connection_status("m1")["connected"] is True


@respx.mock
def test_oauth_disconnect_user_connection():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/user/connection").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.mcps.oauth.disconnect_user_connection("m1")
    assert route.called


@respx.mock
def test_oauth_disconnect_owner_connection():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/owner/connection").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.mcps.oauth.disconnect_owner_connection("m1")
    assert route.called


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/mcps").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MCP})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        mcp = await client.mcps.create(
            {"name": "Internship Board", "transport": "http", "url": "https://mcp.example.com"}
        )
        assert mcp["_id"] == "m1"


@respx.mock
async def test_async_call_tool():
    respx.post(f"{BASE_URL}/api/v1/developer/mcps/m1/call-tool").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [1, 2, 3]})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.mcps.call_tool("m1", "search")
        assert result == [1, 2, 3]


@respx.mock
async def test_async_oauth_disconnect_owner_connection():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/mcps/m1/oauth/owner/connection").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.mcps.oauth.disconnect_owner_connection("m1")
    assert route.called
