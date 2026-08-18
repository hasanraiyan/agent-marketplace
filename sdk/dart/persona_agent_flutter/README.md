# persona_agent_flutter

Flutter chat UI components for the [Persona](https://persona.hasanraiyan.me)
AI agent runtime — message feed, composer, tool-call cards (search results,
read-file, ls, grep, diff), HITL/clarification interrupt cards, subagent
activity dialog, files drawer, sidebar, and a floating chat launcher. Built
on [`persona_agent_client`](../persona_agent_client).

This package mirrors [`@personaai/ui`](https://www.npmjs.com/package/@personaai/ui),
the same platform's React UI components.

## Install

```yaml
dependencies:
  persona_agent_flutter: ^0.1.0
```

## Usage

```dart
import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:persona_agent_flutter/persona_agent_flutter.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late final controller = PersonaChatController(
    config: PersonaConfig(baseUrl: 'https://your-backend.example.com/api/v1'),
    agentId: 'your-agent-id',
  );

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Assistant')),
      body: PersonaChatView(controller: controller),
    );
  }
}
```

Register [`PersonaChatTheme`](lib/src/theme/persona_chat_theme.dart) on your
`ThemeData` for light/dark styling:

```dart
MaterialApp(
  theme: ThemeData(extensions: [PersonaChatTheme.light]),
  darkTheme: ThemeData(extensions: [PersonaChatTheme.dark]),
  ...
);
```

See `example/lib/main.dart` for a complete runnable app.

## What's included

- `PersonaChatView` — the composition root: message feed + interrupt card +
  composer, wired to one `PersonaChatController`.
- `PersonaChatLauncher` — a floating action button + panel variant.
- `PersonaMessageFeed` / `PersonaMessageBubble` — the scrollable transcript,
  with Markdown rendering ([`PersonaMarkdown`](lib/src/widgets/persona_markdown.dart))
  and avatar overrides.
- `PersonaToolTrace` / `PersonaToolGroup` — individual and clustered tool-call
  cards, with specialized rendering for read-file, `ls`, grep, file diffs,
  and web search (`tool_cards/`), falling back to a generic JSON accordion
  for anything else.
- `PersonaSubagentActivityDialog` — a `task` (subagent) tool call's detail
  view, rendering its own nested tool calls recursively with the same
  `PersonaToolTrace` cards.
- `PersonaInterruptCard` — HITL approval / clarification-question prompts.
- `PersonaFilesDrawer`, `PersonaSidebar`, `PersonaMcpConnectBanner`,
  `PersonaSkeleton` — supporting panels/loading states.

## Backend auth

This package never holds a platform credential — see
[`persona_agent_client`](../persona_agent_client)'s README for how
`PersonaConfig`/`getAuthToken` work.
