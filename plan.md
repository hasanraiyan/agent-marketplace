For Flutter/Dart, you don't need to port the whole stack — only the client-side half applies, since Flutter apps are consumers, not backend hosts. The backend pieces (@personaai/sdk, @personaai/runtime, @personaai/nestjs, @personaai/express) are all server-side adapters that a Flutter app would never run itself; it just talks to whatever backend already hosts them (agent-backend directly, or a proxy like Pocketly's NestJS API does).

So the Flutter equivalent is really just what @personaai/react + @personaai/ui cover, split the same way:

1. A core Dart package (mirrors @personaai/react, "pure HTTP client, no deps") — this is the one that actually matters and is non-trivial. It needs to:
  - Parse the backend's SSE stream (data: {...}\n\n lines) and decode the AG-UI event types you've seen throughout this session — TEXT_MESSAGE_CHUNK, TOOL_CALL_CHUNK, REASONING_MESSAGE_CONTENT, CUSTOM events (subagent_activity, hitl_request, clarification_request, mcp_app), RUN_STARTED/RUN_FINISHED/RUN_ERROR.
  - Reproduce useChat's state machine in Dart: accumulate streaming deltas into one message per run, track tool calls by toolCallId, fold subagent_activity events onto the owning tool call, handle thread reload (GET /threads/:id/messages, including reading back subagentTraces), interrupts, files/todos state.
  - Hit the same REST endpoints: threads CRUD, memory, files, MCP connections, agents.
2. A Flutter widgets package (mirrors @personaai/ui) — optional, built on top of package 1. Chat bubbles, tool trace cards, the subagent activity dialog, etc. You could skip this initially and just consume package 1's state with your own Flutter widgets.

If you only need one persona-app in a Flutter app to start, a single combined package (state + a few basic widgets) is a reasonable starting scope — split into two only once you have a second Flutter consumer that wants the state without your specific UI.