import httpx
import pytest
import respx

from personaai import AsyncPersonaClient, PersonaClient
from personaai.errors import PersonaAuthError

BASE_URL = "https://api.test"

MEMORY_FILE = {
    "scope": "user",
    "agentId": None,
    "path": "/memories/user/index.md",
    "content": "# Preferences",
    "mimeType": "text/markdown",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}

LIST_RESULT = {
    "userFiles": [MEMORY_FILE],
    "agentMemories": [
        {
            "agentId": "a1",
            "agentName": "Career Launchpad",
            "files": [
                {
                    "scope": "agent",
                    "agentId": "a1",
                    "path": "/memories/agent/a1/notes.md",
                    "content": "user likes X",
                    "mimeType": "text/markdown",
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                }
            ],
        }
    ],
}


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/memory").mock(
        return_value=httpx.Response(200, json={"success": True, "data": LIST_RESULT})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    result = client.memory.list()
    assert result["userFiles"][0]["path"] == "/memories/user/index.md"
    assert result["agentMemories"][0]["agentId"] == "a1"


@respx.mock
def test_get_file():
    route = respx.get(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MEMORY_FILE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    file = client.memory.get_file("/memories/user/index.md")
    assert file["content"] == "# Preferences"
    sent = route.calls.last.request
    assert sent.url.params["path"] == "/memories/user/index.md"
    assert sent.url.params["scope"] == "user"


@respx.mock
def test_get_file_agent_scope_sends_agent_id():
    route = respx.get(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(200, json={"success": True, "data": MEMORY_FILE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    client.memory.get_file("/memories/agent/a1/notes.md", scope="agent", agent_id="a1")
    sent = route.calls.last.request
    assert sent.url.params["scope"] == "agent"
    assert sent.url.params["agentId"] == "a1"


@respx.mock
def test_write_file():
    route = respx.put(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(201, json={"success": True, "data": MEMORY_FILE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    file = client.memory.write_file("/memories/user/index.md", "# Preferences")
    assert file["path"] == "/memories/user/index.md"
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body == {"path": "/memories/user/index.md", "content": "# Preferences",
                    "scope": None, "agentId": None}


@respx.mock
def test_delete_file():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(204)
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    client.memory.delete_file("/memories/user/index.md")
    sent = route.calls.last.request
    assert sent.url.params["path"] == "/memories/user/index.md"
    assert route.called


@respx.mock
def test_external_user_required_error_surfaces_typed_error():
    respx.get(f"{BASE_URL}/api/v1/developer/memory").mock(
        return_value=httpx.Response(
            400,
            json={
                "success": False,
                "message": "Managing memory requires an asserted external user (x-persona-external-user-id)",
                "code": "EXTERNAL_USER_REQUIRED",
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")  # no external_user_id
    from personaai import PersonaValidationError

    with pytest.raises(PersonaValidationError) as excinfo:
        client.memory.list()
    assert excinfo.value.code == "EXTERNAL_USER_REQUIRED"


@respx.mock
async def test_async_list():
    respx.get(f"{BASE_URL}/api/v1/developer/memory").mock(
        return_value=httpx.Response(200, json={"success": True, "data": LIST_RESULT})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        result = await client.memory.list()
        assert result["userFiles"][0]["path"] == "/memories/user/index.md"


@respx.mock
async def test_async_write_file():
    respx.put(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(201, json={"success": True, "data": MEMORY_FILE})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        file = await client.memory.write_file("/memories/user/index.md", "# Preferences")
        assert file["path"] == "/memories/user/index.md"


@respx.mock
async def test_async_delete_file():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/memory/file").mock(
        return_value=httpx.Response(204)
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        await client.memory.delete_file("/memories/user/index.md")
    assert route.called
