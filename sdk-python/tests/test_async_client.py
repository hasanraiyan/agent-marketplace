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
