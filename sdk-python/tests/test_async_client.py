import httpx
import respx

from personaai import AsyncPersonaClient

BASE_URL = "https://api.test"


@respx.mock
async def test_whoami_calls_the_right_endpoint_and_returns_unwrapped_data():
    respx.get(f"{BASE_URL}/api/v1/developer/whoami").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "domain": "d1",
                    "principalType": "ProjectRuntime",
                    "credentialId": "c1",
                    "externalUserId": "u1",
                },
            },
        )
    )
    client = AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")
    who = await client.whoami()
    assert who["principalType"] == "ProjectRuntime"
    assert who["externalUserId"] == "u1"
    await client.aclose()


async def test_client_is_an_async_context_manager():
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        assert isinstance(client, AsyncPersonaClient)


async def test_client_closes_its_own_httpx_client_when_none_is_supplied():
    client = AsyncPersonaClient(BASE_URL, "keyId.secret")
    owned_httpx_client = client._transport._client
    await client.aclose()
    assert owned_httpx_client.is_closed


async def test_client_never_closes_a_caller_supplied_http_client():
    """A shared httpx.AsyncClient (built once at app startup, passed to many
    per-request AsyncPersonaClient instances for connection-pool reuse) must
    survive any one of those instances being closed — otherwise sharing it
    this way would be unsafe."""
    shared_httpx_client = httpx.AsyncClient()
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", http_client=shared_httpx_client):
        pass
    assert not shared_httpx_client.is_closed
    await shared_httpx_client.aclose()
