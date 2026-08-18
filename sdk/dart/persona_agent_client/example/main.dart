// A plain-Dart CLI — no Flutter — that sends one message to a real Persona
// agent and prints streamed text deltas as they arrive. Proves the whole
// core loop (auth header injection, request shape, SSE parsing, state
// accumulation) works with zero UI code.
//
// Usage:
//   dart run example/main.dart <baseUrl> <agentId> "<message>" [authToken]
//
// Example, against a locally running agent-backend with no auth required:
//   dart run example/main.dart http://localhost:3000/api/v1 <agentId> "hello"
import 'dart:io';

import 'package:persona_agent_client/persona_agent_client.dart';

Future<void> main(List<String> args) async {
  if (args.length < 3) {
    stderr.writeln('Usage: dart run example/main.dart <baseUrl> <agentId> "<message>" [authToken]');
    exit(64);
  }

  final baseUrl = args[0];
  final agentId = args[1];
  final message = args[2];
  final authToken = args.length > 3 ? args[3] : null;

  final config = PersonaConfig(
    baseUrl: baseUrl,
    getAuthToken: authToken == null ? null : () => authToken,
  );

  final controller = PersonaChatController(
    config: config,
    agentId: agentId,
    onFinish: (message) {
      stdout.writeln();
      stdout.writeln('--- done ---');
      if (message.toolCalls?.isNotEmpty ?? false) {
        stdout.writeln('Tool calls: ${message.toolCalls!.map((t) => t.toolName).join(', ')}');
      }
    },
    onError: (error) {
      stderr.writeln('\nError: $error');
    },
  );

  var printedSoFar = '';
  controller.stream.listen((state) {
    final assistant = state.messages.isEmpty ? null : state.messages.last;
    final content = assistant?.content ?? '';
    if (content.length > printedSoFar.length) {
      stdout.write(content.substring(printedSoFar.length));
      printedSoFar = content;
    }
  });

  stdout.writeln('You: $message');
  stdout.write('Agent: ');
  await controller.sendMessage(message);
  controller.dispose();
}
