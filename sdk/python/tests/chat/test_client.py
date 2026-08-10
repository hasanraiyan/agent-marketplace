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
    route = respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Hello"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " there"},
            {"type": "RUN_FINISHED"},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    events = list(client.chat.stream("a1", [{"role": "user", "content": "hi"}]))
    assert [e["type"] for e in events] == [
        "RUN_STARTED",
        "TEXT_MESSAGE_CHUNK",
        "TEXT_MESSAGE_CHUNK",
        "RUN_FINISHED",
    ]
    sent = route.calls.last.request
    assert sent.headers["x-agent-id"] == "a1"
    assert "x-thread-id" not in sent.headers


@respx.mock
def test_stream_forwards_thread_id_header():
    route = respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response({"type": "RUN_FINISHED"})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    list(client.chat.stream("a1", [], thread_id="t1"))
    sent = route.calls.last.request
    assert sent.headers["x-thread-id"] == "t1"


@respx.mock
def test_send_message_accumulates_text():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Hello"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " there"},
            {"type": "RUN_FINISHED"},
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    result = client.chat.send_message("a1", [{"role": "user", "content": "hi"}])
    assert result["text"] == "Hello there"
    assert result["interrupt"] is None
    assert len(result["events"]) == 4


@respx.mock
def test_send_message_surfaces_hitl_interrupt():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"},
            {
                "type": "CUSTOM",
                "name": "hitl_request",
                "value": {"action": "delete_agent"},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    result = client.chat.send_message("a1", [{"role": "user", "content": "hi"}])
    assert result["interrupt"] == {"kind": "hitl", "value": {"action": "delete_agent"}}


@respx.mock
def test_send_message_surfaces_clarification_interrupt():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "CUSTOM", "name": "clarification_request", "value": {"question": "which?"}}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    result = client.chat.send_message("a1", [])
    assert result["interrupt"] == {"kind": "clarification", "value": {"question": "which?"}}


@respx.mock
def test_send_message_sends_resume_payload():
    route = respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response({"type": "RUN_FINISHED"})
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    client.chat.send_message(
        "a1", [], resume={"decisions": [{"action": "delete_agent", "decision": "approve"}]}
    )
    import json as jsonlib

    body = jsonlib.loads(route.calls.last.request.content)
    assert body["resume"] == {"decisions": [{"action": "delete_agent", "decision": "approve"}]}


@respx.mock
def test_stream_raises_typed_error_on_json_error_response():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=httpx.Response(
            401, json={"success": False, "message": "bad credential", "code": "UNAUTHORIZED"}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    with pytest.raises(PersonaAuthError):
        list(client.chat.stream("a1", []))


@respx.mock
def test_stream_retries_on_429_then_streams():
    route = respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        side_effect=[
            httpx.Response(429, headers={"Retry-After": "0"}),
            _sse_response({"type": "RUN_FINISHED"}),
        ]
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    events = list(client.chat.stream("a1", []))
    assert events == [{"type": "RUN_FINISHED"}]
    assert route.call_count == 2


@respx.mock
async def test_async_stream_yields_parsed_events():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "RUN_STARTED"}, {"type": "TEXT_MESSAGE_CHUNK", "delta": "hi"}
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        events = [e async for e in client.chat.stream("a1", [])]
        assert [e["type"] for e in events] == ["RUN_STARTED", "TEXT_MESSAGE_CHUNK"]


@respx.mock
async def test_async_send_message_accumulates_text():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=_sse_response(
            {"type": "TEXT_MESSAGE_CHUNK", "delta": "Hello"},
            {"type": "TEXT_MESSAGE_CHUNK", "delta": " world"},
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        result = await client.chat.send_message("a1", [])
        assert result["text"] == "Hello world"


@respx.mock
async def test_async_stream_raises_typed_error_on_json_error_response():
    respx.post(f"{BASE_URL}/api/v1/developer/agui").mock(
        return_value=httpx.Response(
            403, json={"success": False, "message": "not active", "code": "PROJECT_NOT_ACTIVE"}
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        with pytest.raises(PersonaAuthError):
            async for _ in client.chat.stream("a1", []):
                pass
