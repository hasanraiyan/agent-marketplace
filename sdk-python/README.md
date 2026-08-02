# personaai

Python SDK for the [Persona.ai](https://personaai.com) Developer Platform API — Agents, Skills,
Knowledge bases, MCP connectors, and streaming chat, from your own backend.

> **Server-side only.** Every method on this SDK sends your Project's credential — a server-side
> secret, not something client-side code is ever allowed to see. See
> [Where do I call this from?](../developer-docs/guides/integration-guide.mdx) for the full
> reasoning and a per-resource "who calls this, and when" table.

## Install

```bash
pip install personaai
```

Requires Python 3.9+. Depends on [`httpx`](https://www.python-httpx.org/) only — no `requests`,
no `aiohttp`, no AG-UI protocol package (see [Chat, streamed](#chat-streamed) for why).

## Quickstart

Ships both a sync client and an async client, built on the same `httpx`-based transport — use
whichever matches your framework (Flask/Django vs. FastAPI/`asyncio`).

```python
from personaai import PersonaClient

persona = PersonaClient(
    "https://api.personaai.com",
    credential="<keyId>.<secret>",  # minted via Studio; a server-side secret, see warning above
)

# Sanity-check your credential.
who = persona.whoami()
print(who["principalType"], who["domain"])

# Provision an Agent (a one-time, control-plane call — no external user asserted).
agent = persona.agents.create(
    {
        "name": "Career Launchpad",
        "systemPrompt": "You help students find internships.",
        "providerId": "...",  # an existing Provider's id
        "visibility": "unlisted",
    }
)
```

Or async, identical shape:

```python
import asyncio
from personaai import AsyncPersonaClient

async def main():
    async with AsyncPersonaClient("https://api.personaai.com", credential="<keyId>.<secret>") as persona:
        who = await persona.whoami()
        print(who["principalType"], who["domain"])

asyncio.run(main())
```

Both clients also work as context managers (`with PersonaClient(...) as persona:` /
`async with AsyncPersonaClient(...) as persona:`), which closes the underlying `httpx` client for
you — not required, but tidy for short-lived scripts.

### Acting on behalf of one of your own end users

Most resources (Threads, Files, and any create/list call) behave differently depending on whether
you assert an external user. Construct a second client per request, scoped to whoever is actually
using your product right now — after *your own* auth has confirmed who that is:

```python
user_persona = PersonaClient(
    "https://api.personaai.com",
    credential="<keyId>.<secret>",
    external_user_id=current_user.id,  # your own user id for this person
)

thread = user_persona.threads.create({"agentId": agent["_id"]})
```

## Chat, streamed

`ChatClient.stream()` is a regular generator; `AsyncChatClient.stream()` is an async generator —
each is the natural per-language idiom for the same AG-UI event stream, keyword args
(`thread_id`/`resume`) instead of one options object.

Events are typed as a loose `dict` (`AguiEvent`) rather than pulling in an AG-UI protocol package
— every event has a `"type"` key (compare against the `EventType` string constants) plus
type-specific fields (`delta`, `name`, `value`, ...). This mirrors the Node SDK's own call to
reject `@ag-ui/client`'s heavier dependency chain in favor of a hand-rolled SSE parser.

```python
from personaai import EventType

# Full event stream, for building your own UI.
for event in user_persona.chat.stream(
    agent["_id"], [{"role": "user", "content": "What internships are open right now?"}]
):
    if event["type"] == EventType.TEXT_MESSAGE_CHUNK and event.get("delta"):
        print(event["delta"], end="")

# Or the convenience wrapper — drains the stream, returns the final text.
result = user_persona.chat.send_message(
    agent["_id"], [{"role": "user", "content": "What internships are open right now?"}]
)
print(result["text"])

# If the run pauses on a human-in-the-loop decision, `result["interrupt"]` is set instead of
# finishing normally — resume it on the next call:
if result["interrupt"]:
    user_persona.chat.send_message(
        agent["_id"],
        [],
        resume={"decisions": [{"action": "delete_agent", "decision": "approve"}]},
    )
```

Async is the same shape with `async for`/`await`:

```python
async for event in user_persona.chat.stream(agent["_id"], messages):
    ...

result = await user_persona.chat.send_message(agent["_id"], messages)
```

## Resources

| Client property | Wraps |
| --- | --- |
| `.agents` | `/api/v1/developer/agents` |
| `.skills` | `/api/v1/developer/skills` |
| `.knowledge` | `/api/v1/developer/knowledge` (incl. document upload/search) |
| `.mcps` (+ `.mcps.oauth`) | `/api/v1/developer/mcps` (incl. OAuth owner/user connection flows) |
| `.providers` | `/api/v1/developer/providers` |
| `.threads` | `/api/v1/developer/threads` |
| `.files` | `/api/v1/developer/files` |
| `.chat` | `/api/v1/developer/agui` (streaming) |

Every method mirrors the real REST endpoint 1:1 — no hidden behavior, and request/response bodies
keep the API's own camelCase field names (`providerId`, `systemPrompt`, ...) even though method
and parameter names are Pythonic snake_case. Types are `TypedDict`s exported from the package
root — see each resource file under `src/personaai/resources/` for the exact method signatures.

**Out of scope for this SDK**: Project/Members/Credentials management. Those are Clerk-session
(human admin) operations, a completely different auth model than the machine-credential calls this
SDK makes — manage them from [Developer Studio](https://app.personaai.com/developer) instead.

## Framework recipes

### Flask

No special handling — construct the client once at module scope and use it in your view functions.

```python
# persona.py
import os
from personaai import PersonaClient

persona = PersonaClient(os.environ["PERSONA_BASE_URL"], credential=os.environ["PERSONA_CREDENTIAL"])
```

```python
# app.py
from flask import Flask, request, jsonify
from persona import persona
from personaai import PersonaClient
import os

app = Flask(__name__)

@app.post("/api/chat")
def chat():
    user_persona = PersonaClient(
        os.environ["PERSONA_BASE_URL"],
        credential=os.environ["PERSONA_CREDENTIAL"],
        external_user_id=request.json["userId"],
    )
    result = user_persona.chat.send_message(request.json["agentId"], request.json["messages"])
    return jsonify(result)
```

### FastAPI

Construct the client per-request via a `Depends()` provider so it plugs into FastAPI's own
dependency-injection system — the SDK itself needs no FastAPI-specific support, and this is the
async client since FastAPI route handlers are `async def`.

```python
# deps.py
import os
from personaai import AsyncPersonaClient

def get_persona(external_user_id: str | None = None) -> AsyncPersonaClient:
    return AsyncPersonaClient(
        os.environ["PERSONA_BASE_URL"],
        credential=os.environ["PERSONA_CREDENTIAL"],
        external_user_id=external_user_id,
    )
```

```python
# main.py
from fastapi import Depends, FastAPI
from deps import get_persona
from personaai import AsyncPersonaClient

app = FastAPI()

@app.post("/api/chat")
async def chat(body: dict, current_user_id: str = Depends(get_current_user_id)):
    async with get_persona(external_user_id=current_user_id) as persona:
        return await persona.chat.send_message(body["agentId"], body["messages"])
```

### Django

Wire a module-level singleton in `apps.py` (or a small `persona.py` module), same idea as Flask —
Django views are sync by default, so the sync `PersonaClient` is the natural fit.

```python
# yourapp/persona.py
from django.conf import settings
from personaai import PersonaClient

persona = PersonaClient(settings.PERSONA_BASE_URL, credential=settings.PERSONA_CREDENTIAL)
```

Keep `PERSONA_CREDENTIAL` in your environment / secrets manager and read it into
`settings.py` (`os.environ["PERSONA_CREDENTIAL"]`) — never commit it, and never expose it via a
`TEMPLATE`/context processor a browser can read.

## Development

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"   # .venv/bin/pip on macOS/Linux
.venv/Scripts/pytest                     # unit tests (mocked via respx) — this is what CI runs
.venv/Scripts/mypy                       # mypy --strict
.venv/Scripts/ruff check .               # lint
.venv/Scripts/ruff format --check .      # format check
```

### Integration tests (opt-in, needs a real backend)

`tests/integration/test_live.py` is skipped by default. It exercises the real SDK (both sync and
async clients) against a real, already-running `agent-backend` — see the file's own header comment
for the environment variables it needs (a real Project credential, and a real Provider id for the
Agent/Knowledge/Threads tests). Every resource it creates is deleted by its own test; safe to run
repeatedly against the same Project.

```bash
PERSONA_SDK_INTEGRATION_TEST=1 \
PERSONA_TEST_BASE_URL=https://api.persona.hasanraiyan.me \
PERSONA_TEST_CREDENTIAL=<keyId>.<secret> \
PERSONA_TEST_PROVIDER_ID=<provider-id> \
pytest tests/integration/test_live.py
```

## Publishing

`python -m build` / `twine upload` (or `flit publish`) is not run as part of this repo's CI —
releasing a new version to PyPI is a deliberate, separate action taken by a maintainer once a
version is ready.

## License

MIT
