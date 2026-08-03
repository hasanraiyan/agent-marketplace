import httpx
import pytest
import respx

from personaai._async_http import AsyncTransport
from personaai._base import TransportConfig
from personaai.errors import PersonaApiError, PersonaAuthError

BASE_URL = "https://api.test"


def _transport(**kwargs) -> AsyncTransport:
    config = TransportConfig(base_url=BASE_URL, credential="keyId.secret", **kwargs)
    return AsyncTransport(config)


@respx.mock
async def test_request_unwraps_success_envelope():
    respx.get(f"{BASE_URL}/api/v1/developer/whoami").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"domain": "d1", "principalType": "ProjectMachine", "credentialId": "c1"},
            },
        )
    )
    transport = _transport()
    result = await transport.request("GET", "/api/v1/developer/whoami")
    assert result == {"domain": "d1", "principalType": "ProjectMachine", "credentialId": "c1"}


@respx.mock
async def test_request_injects_auth_and_external_user_headers():
    route = respx.get(f"{BASE_URL}/api/v1/developer/threads").mock(
        return_value=httpx.Response(200, json={"success": True, "data": []})
    )
    transport = _transport(external_user_id="user-1")
    await transport.request("GET", "/api/v1/developer/threads")
    sent = route.calls.last.request
    assert sent.headers["Authorization"] == "Bearer keyId.secret"
    assert sent.headers["x-persona-external-user-id"] == "user-1"


@respx.mock
async def test_request_raises_typed_error_on_failure_envelope():
    respx.post(f"{BASE_URL}/api/v1/developer/agents").mock(
        return_value=httpx.Response(
            401, json={"success": False, "message": "bad credential", "code": "UNAUTHORIZED"}
        )
    )
    transport = _transport()
    with pytest.raises(PersonaAuthError) as exc_info:
        await transport.request("POST", "/api/v1/developer/agents", json={"name": "x"})
    assert exc_info.value.status_code == 401


@respx.mock
async def test_request_retries_on_429_then_succeeds():
    route = respx.get(f"{BASE_URL}/api/v1/developer/skills").mock(
        side_effect=[
            httpx.Response(429, headers={"Retry-After": "0"}),
            httpx.Response(200, json={"success": True, "data": []}),
        ]
    )
    transport = _transport(max_retries=2)
    result = await transport.request("GET", "/api/v1/developer/skills")
    assert result == []
    assert route.call_count == 2


@respx.mock
async def test_request_raises_on_non_json_error_response():
    respx.get(f"{BASE_URL}/api/v1/developer/whoami").mock(
        return_value=httpx.Response(
            500, text="internal error", headers={"content-type": "text/plain"}
        )
    )
    transport = _transport()
    with pytest.raises(PersonaApiError) as exc_info:
        await transport.request("GET", "/api/v1/developer/whoami")
    assert exc_info.value.code == "NON_JSON_ERROR_RESPONSE"


async def test_aclose_closes_its_own_httpx_client():
    transport = _transport()
    await transport.aclose()
    assert transport._client.is_closed


async def test_aclose_never_closes_a_caller_supplied_httpx_client():
    shared_client = httpx.AsyncClient()
    config = TransportConfig(base_url=BASE_URL, credential="keyId.secret")
    transport = AsyncTransport(config, shared_client)

    await transport.aclose()

    assert not shared_client.is_closed
    await shared_client.aclose()
