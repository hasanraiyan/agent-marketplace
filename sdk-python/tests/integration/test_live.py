"""Opt-in integration suite — runs the real SDK against a real,
already-running ``agent-backend`` + real MongoDB. Skipped by default; the
unit tests (mocked ``httpx``) are what run in normal CI. Ported from
``sdk/test/integration/live.test.ts``.

The SDK package must never import from ``agent-backend`` directly (it's a
public PyPI package, not part of that private repo) — so this suite can't
mint its own credential. Instead, point it at a credential you've already
minted (via Studio or the control-plane API) for a disposable test
Project::

    PERSONA_SDK_INTEGRATION_TEST=1 \\
    PERSONA_TEST_BASE_URL=http://localhost:3000 \\
    PERSONA_TEST_CREDENTIAL=<keyId>.<secret> \\
    PERSONA_TEST_PROVIDER_ID=<a real Provider _id in that Project> \\
    pytest tests/integration/test_live.py

``PERSONA_TEST_PROVIDER_ID`` is only required for the Agent/Knowledge/
Threads tests (they need an existing Provider); everything else only
needs the credential. Every resource this suite creates is deleted again
by its own test — safe to run repeatedly against the same Project.

Most tests exercise the sync ``PersonaClient`` (the resource logic is
identical either way, so duplicating every lifecycle in async would be
redundant); a handful of representative tests exercise
``AsyncPersonaClient`` to prove the async transport/resource wiring works
end-to-end too.
"""

from __future__ import annotations

import os
import time
import uuid

import pytest

from personaai import AsyncPersonaClient, EventType, PersonaApiError, PersonaClient

RUN = os.environ.get("PERSONA_SDK_INTEGRATION_TEST") == "1"
BASE_URL = os.environ.get("PERSONA_TEST_BASE_URL", "https://api.persona.hasanraiyan.me")
CREDENTIAL = os.environ.get("PERSONA_TEST_CREDENTIAL")
PROVIDER_ID = os.environ.get("PERSONA_TEST_PROVIDER_ID")

pytestmark = pytest.mark.skipif(
    not RUN or not CREDENTIAL,
    reason="set PERSONA_SDK_INTEGRATION_TEST=1 and PERSONA_TEST_CREDENTIAL to run",
)

needs_provider = pytest.mark.skipif(
    not PROVIDER_ID, reason="set PERSONA_TEST_PROVIDER_ID to run Agent/Knowledge/Threads tests"
)


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def client():
    with PersonaClient(BASE_URL, CREDENTIAL) as c:
        yield c


@pytest.fixture(scope="module")
def runtime_client():
    external_user_id = f"sdk-integration-{int(time.time())}"
    with PersonaClient(BASE_URL, CREDENTIAL, external_user_id=external_user_id) as c:
        yield c


def test_whoami_resolves_a_real_principal_context(client):
    who = client.whoami()
    assert who["principalType"] == "ProjectMachine"
    assert who["domain"]


def test_providers_full_create_get_update_delete_lifecycle(client):
    provider = client.providers.create(
        {
            "label": _unique("sdk-integration-provider"),
            "baseURL": "https://api.openai.com/v1",
            "apiKey": "sk-integration-test-not-real",
            "defaultModel": "gpt-4o-mini",
        }
    )
    assert provider["id"]

    fetched = client.providers.get(provider["id"])
    assert fetched["id"] == provider["id"]

    updated = client.providers.update(provider["id"], {"label": "updated-label"})
    assert updated["label"] == "updated-label"

    client.providers.delete(provider["id"])
    with pytest.raises(PersonaApiError):
        client.providers.get(provider["id"])


def test_skills_full_create_list_get_update_delete_lifecycle(client):
    skill = client.skills.create(
        {
            "name": _unique("sdk-int-skill")[:64].lower(),
            "description": "A skill created by the SDK integration suite.",
            "instructions": "This skill is only used for automated testing.",
        }
    )
    assert skill["_id"]

    fetched = client.skills.get(skill["_id"])
    assert fetched["_id"] == skill["_id"]

    listed = client.skills.list()
    assert any(s["_id"] == skill["_id"] for s in listed)

    updated = client.skills.update(skill["_id"], {"isPublic": True})
    assert updated["isPublic"] is True

    client.skills.delete(skill["_id"])
    with pytest.raises(PersonaApiError):
        client.skills.get(skill["_id"])


@needs_provider
def test_agents_and_chat_create_chat_delete(client, runtime_client):
    agent = client.agents.create(
        {
            "name": _unique("sdk-integration-agent"),
            "systemPrompt": "You are a terse test agent used only for automated integration tests.",
            "providerId": PROVIDER_ID,
            "visibility": "unlisted",
        }
    )
    assert agent["_id"]

    try:
        fetched = client.agents.get(agent["_id"])
        assert fetched["_id"] == agent["_id"]

        listed = client.agents.list()
        assert any(a["_id"] == agent["_id"] for a in listed)

        result = runtime_client.chat.send_message(
            agent["_id"], [{"role": "user", "content": "Reply with only the word: OK"}]
        )
        assert len(result["text"]) > 0
        assert any(e.get("type") == EventType.RUN_FINISHED for e in result["events"])
    finally:
        client.agents.delete(agent["_id"])


@needs_provider
def test_knowledge_upload_and_search_a_document(client):
    kb = client.knowledge.create({"name": _unique("sdk-integration-kb"), "providerId": PROVIDER_ID})
    assert kb["_id"]

    try:
        upload = client.knowledge.upload_documents(
            kb["_id"],
            [
                {
                    "filename": "integration-test.txt",
                    "content": b"The magic word is ZEBRA-INTEGRATION.",
                    "contentType": "text/plain",
                }
            ],
        )
        assert upload["documentCount"] == 1

        results = client.knowledge.search(kb["_id"], "magic word")
        assert len(results) > 0
    finally:
        client.knowledge.delete(kb["_id"])


def test_mcp_full_create_update_delete_lifecycle(client):
    mcp = client.mcps.create(
        {
            "name": _unique("sdk-integration-mcp"),
            "transport": "http",
            "url": "https://mcp.example.com/no-such-server",
        }
    )
    assert mcp["_id"]

    updated = client.mcps.update(mcp["_id"], {"isEnabled": False})
    assert updated["isEnabled"] is False

    client.mcps.delete(mcp["_id"])


@needs_provider
def test_threads_and_files_create_upload_download_clean_up(client, runtime_client):
    agent = client.agents.create(
        {
            "name": _unique("sdk-integration-thread-agent"),
            "systemPrompt": "You are a terse test agent used only for automated integration tests.",
            "providerId": PROVIDER_ID,
            "visibility": "unlisted",
        }
    )

    try:
        thread = runtime_client.threads.create({"agentId": agent["_id"]})
        assert thread["_id"]

        file = runtime_client.files.upload(
            {
                "filename": "integration-test.txt",
                "content": b"integration test file content",
                "contentType": "text/plain",
                "threadId": thread["_id"],
            }
        )

        downloaded = runtime_client.files.download(file["id"])
        assert downloaded.text == "integration test file content"

        runtime_client.files.delete(file["id"])
        runtime_client.threads.delete(thread["_id"])
    finally:
        client.agents.delete(agent["_id"])


async def test_async_whoami_resolves_a_real_principal_context():
    async with AsyncPersonaClient(BASE_URL, CREDENTIAL) as async_client:
        who = await async_client.whoami()
        assert who["principalType"] == "ProjectMachine"


async def test_async_providers_full_create_get_delete_lifecycle():
    async with AsyncPersonaClient(BASE_URL, CREDENTIAL) as async_client:
        provider = await async_client.providers.create(
            {
                "label": _unique("sdk-integration-async-provider"),
                "baseURL": "https://api.openai.com/v1",
                "apiKey": "sk-integration-test-not-real",
                "defaultModel": "gpt-4o-mini",
            }
        )
        assert provider["id"]

        fetched = await async_client.providers.get(provider["id"])
        assert fetched["id"] == provider["id"]

        await async_client.providers.delete(provider["id"])
        with pytest.raises(PersonaApiError):
            await async_client.providers.get(provider["id"])


@needs_provider
async def test_async_chat_send_message_against_a_real_agent():
    external_user_id = f"sdk-integration-async-{int(time.time())}"
    async with AsyncPersonaClient(BASE_URL, CREDENTIAL) as async_client:
        agent = await async_client.agents.create(
            {
                "name": _unique("sdk-integration-async-agent"),
                "systemPrompt": "You are a terse test agent used only for automated tests.",
                "providerId": PROVIDER_ID,
                "visibility": "unlisted",
            }
        )
        try:
            async with AsyncPersonaClient(
                BASE_URL, CREDENTIAL, external_user_id=external_user_id
            ) as runtime_async_client:
                result = await runtime_async_client.chat.send_message(
                    agent["_id"], [{"role": "user", "content": "Reply with only the word: OK"}]
                )
                assert len(result["text"]) > 0
        finally:
            await async_client.agents.delete(agent["_id"])
