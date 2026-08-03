import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
AGENT = {
    "_id": "a1",
    "domain": "d1",
    "ownerType": "Project",
    "name": "Career Launchpad",
    "slug": "career-launchpad",
    "webSearchEnabled": False,
    "visibility": "unlisted",
    "category": "productivity",
    "isActive": True,
    "isMainAgent": False,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": AGENT})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    agent = client.agents.create(
        {"name": "Career Launchpad", "systemPrompt": "Help students.", "providerId": "p1"}
    )
    assert agent["_id"] == "a1"


@respx.mock
def test_create_sends_idempotency_key_header_when_provided():
    route = respx.post(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": AGENT})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.agents.create(
        {"name": "Career Launchpad", "systemPrompt": "Help students.", "providerId": "p1"},
        idempotency_key="idem-key-1",
    )
    assert route.calls.last.request.headers["Idempotency-Key"] == "idem-key-1"


@respx.mock
def test_list_returns_a_pagination_envelope_and_forwards_query():
    route = respx.get(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [AGENT],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.agents.list({"category": "productivity", "scope": "mine"})
    assert result["items"] == [AGENT]
    assert result["pagination"] == {"total": 1, "page": 1, "limit": 20, "pages": 1}
    sent = route.calls.last.request
    assert sent.url.params["category"] == "productivity"
    assert sent.url.params["scope"] == "mine"


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/agents/a1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": AGENT})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.agents.get("a1")["slug"] == "career-launchpad"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/agents/a1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": AGENT})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.agents.update("a1", {"description": "Updated"})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/agents/a1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.agents.delete("a1")
    assert route.called


@respx.mock
def test_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/agents/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["a1"], "failed": [{"id": "a2", "reason": "not found"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.agents.bulk_delete(["a1", "a2"])
    assert result == {"deleted": ["a1"], "failed": [{"id": "a2", "reason": "not found"}]}


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": AGENT})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        agent = await client.agents.create(
            {"name": "Career Launchpad", "systemPrompt": "Help students.", "providerId": "p1"}
        )
        assert agent["_id"] == "a1"


@respx.mock
async def test_async_list():
    respx.get(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [AGENT],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.agents.list()
        assert result["items"] == [AGENT]


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/agents/a1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.agents.delete("a1")
    assert route.called


@respx.mock
async def test_async_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/agents/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["a1"], "failed": [{"id": "a2", "reason": "not found"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.agents.bulk_delete(["a1", "a2"])
        assert result == {"deleted": ["a1"], "failed": [{"id": "a2", "reason": "not found"}]}
