# Changelog

## 0.1.0

- Initial release. Dart port of `@personaai/react`:
  - `PersonaChatController` — the full AG-UI streaming chat state machine
    (`sendMessage`, thread reload with `subagentTraces` reconciliation,
    tool-call chunk accumulation, reasoning, HITL/clarification interrupts,
    subagent activity, workspace files/todos, stop/reload/clear).
  - `PersonaThreadsController`, `PersonaFilesController`,
    `PersonaMemoryController`, `PersonaMcpConnectionsController`,
    `PersonaAgentsController`, `PersonaConnectionController`.
  - Full model layer (`PersonaMessage`, `PersonaToolCall`,
    `PersonaStreamingEvent` and its full AG-UI event union, `PersonaThread`,
    `PersonaFileItem`, `PersonaMemoryList`, etc.).
