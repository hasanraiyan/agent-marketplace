# @personaai/sdk

Node.js/TypeScript SDK for the Persona.ai Developer Platform API.

> **Server-side only.** The credential this client holds is a server-side secret — never construct
> `PersonaClient` in a browser bundle or a Next.js Client Component. See the
> [Integration Guide](../developer-docs/guides/integration-guide.mdx) for why.

**Status: early scaffold (SDK-1 of the Phase 12 build-out).** Currently implements auth, the
shared HTTP/error layer, and `whoami()`. Resource clients (Agents, Skills, Knowledge, MCP,
Providers, Threads, Files) and the AG-UI chat client land in subsequent PRs — see the plan for the
full sequence. A proper quickstart + framework recipes (Express/NestJS/Next.js) ship in the final
PR of this build-out.

## Development

```bash
pnpm install
pnpm test         # vitest
pnpm typecheck     # tsc --noEmit
pnpm build         # tsup → dist/
```
