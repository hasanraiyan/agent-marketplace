import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
THREAD = {
    "_id": "t1",
    "domain": "d1",
    "agentId": "a1",
    "subjectType": "ExternalUser",
    "externalUserId": "u1",
    "threadId": "thread-key-1",
    "title": "Untitled",
    "lastMessageAt": "2026-01-01T00:00:00.000Z",
    "isArchived": False,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


def _client() -> PersonaClient:
    return PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/threads").mock(
        return_value=httpx.Response(200, json={"success": True, "data": THREAD})
    )
    thread = _client().threads.create({"agentId": "a1"})
    assert thread["_id"] == "t1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/threads").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [THREAD]})
    )
    assert _client().threads.list() == [THREAD]


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/threads/t1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": THREAD})
    )
    assert _client().threads.get("t1")["title"] == "Untitled"


@respx.mock
def test_update_title_sends_title_body():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/threads/t1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": THREAD})
    )
    _client().threads.update_title("t1", "Internship search")
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body == {"title": "Internship search"}


@respx.mock
def test_update_archives_without_a_title():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/threads/t1").mock(
        return_value=httpx.Response(
            200, json={"success": True, "data": {**THREAD, "isArchived": True}}
        )
    )
    result = _client().threads.update("t1", {"isArchived": True})
    assert result["isArchived"] is True
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body == {"isArchived": True}


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/threads/t1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    _client().threads.delete("t1")
    assert route.called


@respx.mock
def test_get_messages():
    payload = {"messages": [{"role": "user", "content": "hi"}], "state": {}, "subagentTraces": {}}
    respx.get(f"{BASE_URL}/api/v1/developer/threads/t1/messages").mock(
        return_value=httpx.Response(200, json={"success": True, "data": payload})
    )
    result = _client().threads.get_messages("t1")
    assert result["messages"] == [{"role": "user", "content": "hi"}]


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/threads").mock(
        return_value=httpx.Response(200, json={"success": True, "data": THREAD})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        thread = await client.threads.create({"agentId": "a1"})
        assert thread["_id"] == "t1"


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/threads/t1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        await client.threads.delete("t1")
    assert route.called
