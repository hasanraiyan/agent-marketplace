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
