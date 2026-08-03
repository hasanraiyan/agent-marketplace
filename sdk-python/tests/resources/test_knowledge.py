import httpx
import respx

from personaai import AsyncPersonaClient, PersonaClient

BASE_URL = "https://api.test"
KB = {
    "_id": "kb1",
    "domain": "d1",
    "ownerType": "Project",
    "name": "Internship Postings",
    "isPublic": False,
    "documentCount": 0,
    "chunkCount": 0,
    "qdrantCollectionName": "kb_kb1",
    "documents": [],
    "embeddingModel": "text-embedding-3-small",
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "topK": 5,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
}


@respx.mock
def test_create():
    respx.post(f"{BASE_URL}/api/v1/developer/knowledge").mock(
        return_value=httpx.Response(200, json={"success": True, "data": KB})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    kb = client.knowledge.create({"name": "Internship Postings", "providerId": "p1"})
    assert kb["_id"] == "kb1"


@respx.mock
def test_list():
    respx.get(f"{BASE_URL}/api/v1/developer/knowledge").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "items": [KB],
                    "pagination": {"total": 1, "page": 1, "limit": 20, "pages": 1},
                },
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.knowledge.list()
    assert result["items"] == [KB]
    assert result["pagination"] == {"total": 1, "page": 1, "limit": 20, "pages": 1}


@respx.mock
def test_get():
    respx.get(f"{BASE_URL}/api/v1/developer/knowledge/kb1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": KB})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.knowledge.get("kb1")["name"] == "Internship Postings"


@respx.mock
def test_update():
    route = respx.patch(f"{BASE_URL}/api/v1/developer/knowledge/kb1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": KB})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.knowledge.update("kb1", {"description": "Updated"})
    assert route.called


@respx.mock
def test_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/knowledge/kb1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    client.knowledge.delete("kb1")
    assert route.called


@respx.mock
def test_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/knowledge/kb1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    usage = client.knowledge.get_usage("kb1")
    assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}


@respx.mock
def test_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/knowledge/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["kb1"], "failed": [{"id": "kb2", "reason": "not found"}]},
            },
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.knowledge.bulk_delete(["kb1", "kb2"])
    assert result == {"deleted": ["kb1"], "failed": [{"id": "kb2", "reason": "not found"}]}


@respx.mock
def test_upload_documents_sends_multipart():
    upload_result = {
        "documentCount": 1,
        "chunkCount": 3,
        "files": [{"fileName": "a.txt", "fileSize": 5, "mimeType": "text/plain", "chunkCount": 3}],
    }
    route = respx.post(f"{BASE_URL}/api/v1/developer/knowledge/kb1/documents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": upload_result})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    result = client.knowledge.upload_documents(
        "kb1", [{"filename": "a.txt", "content": b"hello", "contentType": "text/plain"}]
    )
    assert result["documentCount"] == 1
    sent = route.calls.last.request
    assert sent.headers["content-type"].startswith("multipart/form-data")
    assert b'name="files"; filename="a.txt"' in sent.content
    assert b"hello" in sent.content


@respx.mock
def test_list_documents():
    doc = {
        "fileName": "a.txt",
        "fileSize": 5,
        "mimeType": "text/plain",
        "chunkCount": 3,
        "uploadedAt": "2026-01-01T00:00:00.000Z",
    }
    respx.get(f"{BASE_URL}/api/v1/developer/knowledge/kb1/documents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [doc]})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    assert client.knowledge.list_documents("kb1") == [doc]


@respx.mock
def test_delete_document_url_encodes_source_name():
    result = {"removedChunks": 3, "remainingDocuments": 0, "remainingChunks": 0}
    route = respx.delete(f"{BASE_URL}/api/v1/developer/knowledge/kb1/documents/a%2Fb.txt").mock(
        return_value=httpx.Response(200, json={"success": True, "data": result})
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    deleted = client.knowledge.delete_document("kb1", "a/b.txt")
    assert deleted["removedChunks"] == 3
    assert route.called


@respx.mock
def test_search_sends_query_and_top_k():
    route = respx.post(f"{BASE_URL}/api/v1/developer/knowledge/kb1/search").mock(
        return_value=httpx.Response(
            200, json={"success": True, "data": [{"text": "x", "source": "a.txt", "score": 0.9}]}
        )
    )
    client = PersonaClient(BASE_URL, "keyId.secret")
    results = client.knowledge.search("kb1", "internships", top_k=3)
    assert results[0]["score"] == 0.9
    sent = route.calls.last.request
    import json as jsonlib

    body = jsonlib.loads(sent.content)
    assert body == {"query": "internships", "topK": 3}


@respx.mock
async def test_async_create():
    respx.post(f"{BASE_URL}/api/v1/developer/knowledge").mock(
        return_value=httpx.Response(200, json={"success": True, "data": KB})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        kb = await client.knowledge.create({"name": "Internship Postings", "providerId": "p1"})
        assert kb["_id"] == "kb1"


@respx.mock
async def test_async_upload_documents():
    upload_result = {
        "documentCount": 1,
        "chunkCount": 3,
        "files": [{"fileName": "a.txt", "fileSize": 5, "mimeType": "text/plain", "chunkCount": 3}],
    }
    respx.post(f"{BASE_URL}/api/v1/developer/knowledge/kb1/documents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": upload_result})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.knowledge.upload_documents(
            "kb1", [{"filename": "a.txt", "content": b"hello"}]
        )
        assert result["chunkCount"] == 3


@respx.mock
async def test_async_delete():
    route = respx.delete(f"{BASE_URL}/api/v1/developer/knowledge/kb1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": None})
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        await client.knowledge.delete("kb1")
    assert route.called


@respx.mock
async def test_async_bulk_delete():
    respx.post(f"{BASE_URL}/api/v1/developer/knowledge/bulk-delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"deleted": ["kb1"], "failed": [{"id": "kb2", "reason": "not found"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        result = await client.knowledge.bulk_delete(["kb1", "kb2"])
        assert result == {"deleted": ["kb1"], "failed": [{"id": "kb2", "reason": "not found"}]}


@respx.mock
async def test_async_get_usage():
    respx.get(f"{BASE_URL}/api/v1/developer/knowledge/kb1/usage").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]},
            },
        )
    )
    async with AsyncPersonaClient(BASE_URL, "keyId.secret") as client:
        usage = await client.knowledge.get_usage("kb1")
        assert usage == {"agentCount": 1, "agents": [{"_id": "a1", "name": "Agent One"}]}
