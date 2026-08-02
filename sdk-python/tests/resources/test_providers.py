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
