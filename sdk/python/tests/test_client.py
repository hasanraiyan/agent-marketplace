import httpx
import respx

from personaai import PersonaClient

BASE_URL = "https://api.test"


@respx.mock
def test_whoami_calls_the_right_endpoint_and_returns_unwrapped_data():
    respx.get(f"{BASE_URL}/api/v1/developer/whoami").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"domain": "d1", "principalType": "ProjectMachine", "credentialId": "c1"},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    who = client.whoami()
    assert who["principalType"] == "ProjectMachine"
    assert who["domain"] == "d1"


def test_client_is_a_context_manager():
    with PersonaClient(BASE_URL, "keyId.secret") as client:
        assert isinstance(client, PersonaClient)


def test_client_closes_its_own_httpx_client_when_none_is_supplied():
    client = PersonaClient(BASE_URL, "keyId.secret")
    owned_httpx_client = client._transport._client
    client.close()
    assert owned_httpx_client.is_closed


def test_client_never_closes_a_caller_supplied_http_client():
    """A shared httpx.Client (built once at app startup, passed to many
    per-request PersonaClient instances for connection-pool reuse) must
    survive any one of those instances being closed — otherwise sharing it
    this way would be unsafe."""
    shared_httpx_client = httpx.Client()
    with PersonaClient(BASE_URL, "keyId.secret", http_client=shared_httpx_client):
        pass
    assert not shared_httpx_client.is_closed
    shared_httpx_client.close()
