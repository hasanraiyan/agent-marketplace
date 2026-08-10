import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"

STORE = {
    "_id": "s1",
    "domain": "dom-1",
    "name": "shared-kb",
    "description": "Shared project notes",
    "scope": "domain",
    "accessMode": "readwrite",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}

STORE_FILE = {
    "path": "/notes.md",
    "content": "# Notes",
    "mimeType": "text/markdown",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}

PAGINATED = {
    "items": [STORE],
    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/stores").mock(
        return_value=httpx.Response(201, json={"success": True, "data": STORE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    store = client.stores.create({"name": "shared-kb", "scope": "domain"})
    assert store["_id"] == "s1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/stores").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PAGINATED})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.stores.list({"search": "kb"})
    assert result["items"][0]["_id"] == "s1"
    assert result["pagination"]["total"] == 1


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/stores/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": STORE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.stores.get("s1")["name"] == "shared-kb"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/stores/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": STORE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.stores.update("s1", {"accessMode": "readonly"})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/stores/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.stores.delete("s1")
    assert route.called


@respx.mock
def test_list_files_unwraps_files_envelope():
    respx.get(f"{BASE_URL}/api/v1/developer/stores/s1/files").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"files": [STORE_FILE]}})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    files = client.stores.list_files("s1")
    assert files == [STORE_FILE]


@respx.mock
def test_get_file():
    route = respx.get(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(200, json={"success": True, "data": STORE_FILE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    file = client.stores.get_file("s1", "/notes.md")
    assert file["content"] == "# Notes"
    assert route.calls.last.request.url.params["path"] == "/notes.md"


@respx.mock
def test_write_file():
    route = respx.put(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(201, json={"success": True, "data": STORE_FILE})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    file = client.stores.write_file("s1", "/notes.md", "# Notes")
    assert file["path"] == "/notes.md"
    import json as jsonlib

    assert jsonlib.loads(route.calls.last.request.content) == {
        "path": "/notes.md",
        "content": "# Notes",
    }


@respx.mock
def test_delete_file():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(204)
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.stores.delete_file("s1", "/notes.md")
    assert route.calls.last.request.url.params["path"] == "/notes.md"


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/stores").mock(
        return_value=httpx.Response(201, json={"success": True, "data": STORE})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        store = await client.stores.create({"name": "shared-kb", "scope": "domain"})
        assert store["_id"] == "s1"


@respx.mock
async def test_async_list_files():
    respx.get(f"{BASE_URL}/api/v1/developer/stores/s1/files").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"files": [STORE_FILE]}})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        files = await client.stores.list_files("s1")
        assert files == [STORE_FILE]


@respx.mock
async def test_async_get_file():
    respx.get(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(200, json={"success": True, "data": STORE_FILE})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        file = await client.stores.get_file("s1", "/notes.md")
        assert file["path"] == "/notes.md"


@respx.mock
async def test_async_write_file():
    respx.put(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(201, json={"success": True, "data": STORE_FILE})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        file = await client.stores.write_file("s1", "/notes.md", "# Notes")
        assert file["content"] == "# Notes"


@respx.mock
async def test_async_delete_file():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/stores/s1/file").mock(
        return_value=httpx.Response(204)
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.stores.delete_file("s1", "/notes.md")
    assert route.called
