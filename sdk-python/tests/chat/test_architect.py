import httpx
import pytest
import respx

from personaai import AsyncPersonaClient, PersonaClient
from personaai.errors import PersonaAuthError

BASE_URL = "https://api.test"


def _sse_body(*events: dict) -> bytes:
    import json as jsonlib

    return "".join(f"data: {jsonlib.dumps(e)}\n\n" for e in events).encode()


def _sse_response(*events: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status, content=_sse_body(*events), headers={"content-type": "text/event-stream"}
    )


@respx.mock
def test_stream_yields_parsed_events_in_order():
    route = respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Creating"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " agent"},
            {"type": "RUN_FINISHED"},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    events = list(client.architect.stream([{"role": "user", "content": "Create an agent"}]))
    assert [e["type"] for e in events] == [
        "RUN_STARTED",
        "TEXT_MESSAGE_CHUNK",
        "TEXT_MESSAGE_CHUNK",
        "RUN_FINISHED",
    ]
    # No agent_id/thread_id headers for the Architect.
    sent = route.calls.last.request
    assert "x-agent-id" not in sent.headers
    assert "x-thread-id" not in sent.headers


@respx.mock
def test_send_message_accumulates_text():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Created"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " agent!"},
            {"type": "RUN_FINISHED"},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.architect.send_message([{"role": "user", "content": "Create an agent"}])
    assert result["text"] == "Created agent!"
    assert result["interrupt"] is None
    assert len(result["events"]) == 4


@respx.mock
def test_send_message_surfaces_hitl_interrupt():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {"type": "CUSTOM", "name": "hitl_request", "value": {"action": "upsert_agent"}},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.architect.send_message([{"role": "user", "content": "Create an agent"}])
    assert result["interrupt"] == {"kind": "hitl", "value": {"action": "upsert_agent"}}


@respx.mock
def test_send_message_sends_resume_payload():
    route = respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response({"type": "RUN_FINISHED"})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.architect.send_message(
        [], resume={"decisions": [{"action": "upsert_agent", "decision": "approve"}]}
    )
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body["resume"] == {"decisions": [{"action": "upsert_agent", "decision": "approve"}]}


@respx.mock
def test_stream_raises_typed_error_on_json_error_response():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=httpx.Response(
            401, json={"success": False, "message": "bad credential", "code": "UNAUTHORIZED"}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    with pytest.raises(PersonaAuthError):
        list(client.architect.stream([]))


@respx.mock
def test_stream_retries_on_429_then_streams():
    route = respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        side_effect=[
            httpx.Response(429, headers={"Retry-After": "0"}),
            _sse_response({"type": "RUN_FINISHED"}),
        ]
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    events = list(client.architect.stream([]))
    assert events == [{"type": "RUN_FINISHED"}]
    assert route.call_count == 2


@respx.mock
def test_works_with_runtime_plane_client():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response({"type": "TEXT_MESSAGE_CHUNK", "delta": "hi"})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    result = client.architect.send_message([])
    assert result["text"] == "hi"


@respx.mock
async def test_async_stream_yields_parsed_events():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"}, {"type": "TEXT_MESSAGE_CHUNK", "delta": "hi"}
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        events = [e async for e in client.architect.stream([])]
        assert [e["type"] for e in events] == ["RUN_STARTED", "TEXT_MESSAGE_CHUNK"]


@respx.mock
async def test_async_send_message_accumulates_text():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=_sse_response(
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Hello"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " world"},
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.architect.send_message([])
        assert result["text"] == "Hello world"


@respx.mock
async def test_async_stream_raises_typed_error_on_json_error_response():
    respx.post(f"{BASE_URL}/api/v1/developer/architect/agui").mock(
        return_value=httpx.Response(
            403, json={"success": False, "message": "not active", "code": "PROJECT_NOT_ACTIVE"}
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        with pytest.raises(PersonaAuthError):
            async for _ in client.architect.stream([]):
                pass
