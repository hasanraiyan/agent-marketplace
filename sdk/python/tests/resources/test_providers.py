import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
PROVIDER = {
    "id": "p1",
    "label": "OpenAI",
    "baseURL": "https://api.openai.com/v1",
    "defaultModel": "gpt-4o",
    "isDefault": True,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/providers").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PROVIDER})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    provider = client.providers.create(
        {
            "label": "OpenAI",
            "baseURL": "https://api.openai.com/v1",
            "apiKey": "sk-x",
            "defaultModel": "gpt-4o",
        }
    )
    assert provider["id"] == "p1"


@respx.mock
def test_create_sends_idempotency_key_header_when_provided():
    route = respx.post(f"{BASE_URL}/api/v1/developer/providers").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PROVIDER})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.providers.create(
        {
            "label": "OpenAI",
            "baseURL": "https://api.openai.com/v1",
            "apiKey": "sk-x",
            "defaultModel": "gpt-4o",
        },
        idempotency_key="idem-key-1",
    )
    assert route.calls.last.request.headers["Idempotency-Key"] == "idem-key-1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/providers").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [PROVIDER]})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.providers.list() == [PROVIDER]


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/providers/p1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PROVIDER})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.providers.get("p1")["label"] == "OpenAI"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/providers/p1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PROVIDER})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.providers.update("p1", {"label": "OpenAI (updated)"})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/providers/p1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.providers.delete("p1")
    assert route.called


@respx.mock
def test_test_connection():
    respx.post(f"{BASE_URL}/api/v1/developer/providers/p1/test-connection").mock(
        return_value=httpx.Response(
            200, json={"success": True, "data": {"success": True, "message": "ok"}}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.providers.test_connection("p1")
    assert result["success"] is True


@respx.mock
def test_get_models():
    respx.get(f"{BASE_URL}/api/v1/developer/providers/p1/models").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [{"id": "gpt-4o"}]})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    models = client.providers.get_models("p1")
    assert models == [{"id": "gpt-4o"}]


@respx.mock
def test_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/providers/p1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    usage = client.providers.get_usage("p1")
    assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}


@respx.mock
def test_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/providers/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["p1"], "failed": [{"id": "p2", "reason": "not found"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.providers.bulk_delete(["p1", "p2"])
    assert result == {"deleted": ["p1"], "failed": [{"id": "p2", "reason": "not found"}]}


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/providers").mock(
        return_value=httpx.Response(200, json={"success": True, "data": PROVIDER})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        provider = await client.providers.create(
            {
                "label": "OpenAI",
                "baseURL": "https://api.openai.com/v1",
                "apiKey": "sk-x",
                "defaultModel": "gpt-4o",
            }
        )
        assert provider["id"] == "p1"


@respx.mock
async def test_async_list():
    respx.get(f"{BASE_URL}/api/v1/developer/providers").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [PROVIDER]})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        assert await client.providers.list() == [PROVIDER]


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/providers/p1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.providers.delete("p1")
    assert route.called


@respx.mock
async def test_async_get_models():
    respx.get(f"{BASE_URL}/api/v1/developer/providers/p1/models").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [{"id": "gpt-4o"}]})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        models = await client.providers.get_models("p1")
        assert models == [{"id": "gpt-4o"}]


@respx.mock
async def test_async_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/providers/p1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        usage = await client.providers.get_usage("p1")
        assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}


@respx.mock
async def test_async_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/providers/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["p1"], "failed": [{"id": "p2", "reason": "not found"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.providers.bulk_delete(["p1", "p2"])
        assert result == {"deleted": ["p1"], "failed": [{"id": "p2", "reason": "not found"}]}
