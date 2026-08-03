import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
SKILL = {
    "_id": "s1",
    "domain": "d1",
    "ownerType": "Project",
    "name": "Resume Reviewer",
    "description": "Reviews resumes",
    "instructions": "Review the resume and suggest edits.",
    "files": [],
    "isPublic": False,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": SKILL})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    skill = client.skills.create(
        {"name": "Resume Reviewer", "description": "Reviews resumes", "instructions": "Review it."}
    )
    assert skill["_id"] == "s1"


@respx.mock
def test_list_returns_bare_array_and_forwards_query():
    route = respx.get(f"{BASE_URL}/api/v1/developer/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [SKILL]})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    skills = client.skills.list({"page": 1, "scope": "mine"})
    assert skills == [SKILL]
    sent = route.calls.last.request
    assert sent.url.params["page"] == "1"
    assert sent.url.params["scope"] == "mine"


@respx.mock
def test_list_with_no_params():
    respx.get(f"{BASE_URL}/api/v1/developer/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": []})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.skills.list() == []


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/skills/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": SKILL})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.skills.get("s1")["name"] == "Resume Reviewer"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/skills/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": SKILL})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.skills.update("s1", {"description": "Updated"})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/skills/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.skills.delete("s1")
    assert route.called


@respx.mock
def test_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/skills/s1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    usage = client.skills.get_usage("s1")
    assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": SKILL})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        skill = await client.skills.create(
            {
                "name": "Resume Reviewer",
                "description": "Reviews resumes",
                "instructions": "Review it.",
            }
        )
        assert skill["_id"] == "s1"


@respx.mock
async def test_async_list():
    respx.get(f"{BASE_URL}/api/v1/developer/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [SKILL]})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        skills = await client.skills.list()
        assert skills == [SKILL]


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/skills/s1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.skills.delete("s1")
    assert route.called


@respx.mock
async def test_async_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/skills/s1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        usage = await client.skills.get_usage("s1")
        assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}
