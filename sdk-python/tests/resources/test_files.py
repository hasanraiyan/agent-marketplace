import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
FILE = {
    "id": "f1",
    "originalName": "resume.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "agentId": "a1",
    "threadId": None,
    "createdAt": "2026-01-01T00:00:00.000Z",
}


def _client() -> PersonaClient:
    return PersonaClient(BASE_URL, "keyId.secret", external_user_id="u1")


@respx.mock
def test_upload_sends_multipart_with_optional_fields():
    route = respx.post(f"{BASE_URL}/api/v1/developer/files").mock(
        return_value=httpx.Response(200, json={"success": True, "data": FILE})
    )
    result = _client().files.upload(
        {
            "filename": "resume.pdf",
            "content": b"%PDF-1.4",
            "contentType": "application/pdf",
            "agentId": "a1",
        }
    )
    assert result["id"] == "f1"
    sent = route.calls.last.request
    assert sent.headers["content-type"].startswith("multipart/form-data")
    assert b'name="file"; filename="resume.pdf"' in sent.content
    assert b'name="agentId"' in sent.content
    assert b"a1" in sent.content
    assert b"threadId" not in sent.content


@respx.mock
def test_upload_sends_idempotency_key_header_when_provided():
    route = respx.post(f"{BASE_URL}/api/v1/developer/files").mock(
        return_value=httpx.Response(200, json={"success": True, "data": FILE})
    )
    _client().files.upload({"filename": "a.txt", "content": b"hi"}, idempotency_key="idem-key-1")
    assert route.calls.last.request.headers["Idempotency-Key"] == "idem-key-1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/files").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [FILE],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    result = _client().files.list()
    assert result["items"] == [FILE]
    assert result["pagination"] == {"total": 1, "page": 1, "limit": 20, "pages": 1}


@respx.mock
def test_download_returns_raw_response():
    respx.get(f"{BASE_URL}/api/v1/developer/files/f1").mock(
        return_value=httpx.Response(
            200, content=b"%PDF-1.4 binary", headers={"content-type": "application/pdf"}
        )
    )
    response = _client().files.download("f1")
    assert isinstance(response, httpx.Response)
    assert response.content == b"%PDF-1.4 binary"


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/files/f1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    _client().files.delete("f1")
    assert route.called


@respx.mock
def test_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/files/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["f1"], "failed": [{"id": "f2", "reason": "not found"}]},
            },
        )
    )
    result = _client().files.bulk_delete(["f1", "f2"])
    assert result == {"deleted": ["f1"], "failed": [{"id": "f2", "reason": "not found"}]}


@respx.mock
async def test_async_upload():
    respx.post(f"{BASE_URL}/api/v1/developer/files").mock(
        return_value=httpx.Response(200, json={"success": True, "data": FILE})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        result = await client.files.upload({"filename": "resume.pdf", "content": b"%PDF-1.4"})
        assert result["id"] == "f1"


@respx.mock
async def test_async_download_returns_raw_response():
    respx.get(f"{BASE_URL}/api/v1/developer/files/f1").mock(
        return_value=httpx.Response(
            200, content=b"binary", headers={"content-type": "application/octet-stream"}
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        response = await client.files.download("f1")
        assert isinstance(response, httpx.Response)
        assert response.content == b"binary"


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/files/f1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        await client.files.delete("f1")
    assert route.called


@respx.mock
async def test_async_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/files/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["f1"], "failed": [{"id": "f2", "reason": "not found"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret", external_user_id="u1") as client:
        result = await client.files.bulk_delete(["f1", "f2"])
        assert result == {"deleted": ["f1"], "failed": [{"id": "f2", "reason": "not found"}]}
