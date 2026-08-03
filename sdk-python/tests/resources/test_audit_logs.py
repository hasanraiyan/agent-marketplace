import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
ENTRY = {
    "eventType": "credential.created",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "actorContextType": "ProjectAdmin",
    "actorIdentity": "user_1",
    "targetDomain": "project-1",
    "targetResourceId": "cred_1",
    "metadata": {},
}


@respx.mock
def test_list_returns_a_pagination_envelope_and_forwards_query():
    route = respx.get(f"{BASE_URL}/api/v1/developer/audit-logs").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [ENTRY],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.audit_logs.list({"eventType": "credential.created"})
    assert result["items"] == [ENTRY]
    assert result["pagination"] == {"total": 1, "page": 1, "limit": 20, "pages": 1}
    sent = route.calls.last.request
    assert sent.url.params["eventType"] == "credential.created"


@respx.mock
def test_list_returns_an_empty_envelope_for_a_project_runtime_context_client():
    respx.get(f"{BASE_URL}/api/v1/developer/audit-logs").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [],
                    "pagination": {"total": 0, "page": 1, "limit": 20, "pages": 0},
                },
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret", external_user_id="sabik-42")
    result = client.audit_logs.list()
    assert result == {"items": [], "pagination": {"total": 0, "page": 1, "limit": 20, "pages": 0}}


@respx.mock
async def test_async_list():
    respx.get(f"{BASE_URL}/api/v1/developer/audit-logs").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [ENTRY],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.audit_logs.list()
        assert result["items"] == [ENTRY]
