# persona_agent_client

Dart client for the [Persona](https://persona.hasanraiyan.me) AI agent
runtime — AG-UI protocol streaming chat, thread history, files, memory, and
MCP connections. Framework-agnostic: pure Dart, no Flutter dependency, so it
works in a CLI, a server, or any Flutter app.

This package mirrors [`@personaai/react`](https://www.npmjs.com/package/@personaai/react),
the same platform's React/web client. For Flutter widgets built on top of
this package, see [`persona_agent_flutter`](../persona_agent_flutter).

## Install

```yaml
dependencies:
  persona_agent_client: ^0.1.0
```

## Usage

```dart
import 'package:persona_agent_client/persona_agent_client.dart';

final config = PersonaConfig(
  baseUrl: 'https://your-backend.example.com/api/v1',
  getAuthToken: () async => await readTokenFromSecureStorage(),
);

final chat = PersonaChatController(config: config, agentId: 'your-agent-id');

// Any UI (or plain code) subscribes to state changes:
chat.stream.listen((state) {
  print(state.messages.map((m) => '${m.role}: ${m.content}').join('\n'));
});

await chat.sendMessage('Hello!');
```

`PersonaChatController` is not tied to any state-management framework — it's
a plain `Stream`-based controller (see `PersonaController<S>`). Wrap it in a
Riverpod `Notifier`, a Bloc, a `ChangeNotifier`, or just use `StreamBuilder`
directly.

See `example/main.dart` for a complete runnable CLI that streams a response
to stdout.

## What's included

- `PersonaChatController` — the chat state machine: sending messages,
  parsing the AG-UI SSE stream (text, tool calls, reasoning, HITL/
  clarification interrupts, subagent activity, workspace files/todos),
  thread reload, stop/reload/clear.
- `PersonaThreadsController`, `PersonaFilesController`, `PersonaMemoryController`,
  `PersonaMcpConnectionsController`, `PersonaAgentsController`,
  `PersonaConnectionController` — thread/file/memory/MCP/agent CRUD and a
  health check.
- The full `PersonaMessage`/`PersonaToolCall`/`PersonaStreamingEvent`/etc.
  model layer, all `freezed`-based (except the streaming event union, a
  plain `sealed class` hierarchy).

## Backend auth

This client never holds a platform credential itself — point `baseUrl` at
whatever backend already authenticates your app's own users (e.g. your own
NestJS/Express API mounting `@personaai/nestjs`/`@personaai/express`), and
supply `getAuthToken` with your app's own token. See the main
[agent-marketplace](https://github.com/hasanraiyan/agent-marketplace) repo
for the full platform architecture.
