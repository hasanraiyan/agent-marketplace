# personaai

Python SDK for the [Persona.ai](https://personaai.com) Developer Platform API — Agents, Skills,
Knowledge bases, MCP connectors, and streaming chat, from your own backend.

> **Server-side only.** Every method on this SDK sends your Project's credential — a server-side
> secret, not something client-side code is ever allowed to see.

**Status**: foundation only (`PersonaClient`/`AsyncPersonaClient` + `whoami()`). Resource clients
(Agents, Skills, Knowledge, MCP, Providers, Threads, Files) and the AG-UI chat client land in
follow-up PRs — see `sdk-python`'s section of the Phase 12 plan for the full sequence. This file
will be expanded into a full quickstart (mirroring `sdk/README.md`) once those land.

## Install (once published)

```bash
pip install personaai
```

Requires Python 3.9+.

## Quickstart

```python
from personaai import PersonaClient

persona = PersonaClient("https://api.personaai.com", credential="<keyId>.<secret>")
who = persona.whoami()
print(who["principalType"], who["domain"])
```

Or async:

```python
import asyncio
from personaai import AsyncPersonaClient

async def main():
    async with AsyncPersonaClient("https://api.personaai.com", credential="<keyId>.<secret>") as persona:
        who = await persona.whoami()
        print(who["principalType"], who["domain"])

asyncio.run(main())
```

## Development

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"   # .venv/bin/pip on macOS/Linux
.venv/Scripts/pytest                     # unit tests (mocked via respx)
.venv/Scripts/mypy                       # typecheck
.venv/Scripts/ruff check .               # lint
```

## License

MIT
