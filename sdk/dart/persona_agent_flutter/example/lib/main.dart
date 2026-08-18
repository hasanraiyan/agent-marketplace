// Runnable Flutter example — a live streaming conversation against a real
// Persona agent. Fill in baseUrl/agentId below (and authToken if your
// backend requires one), then `flutter run -d chrome` (or any connected
// device/desktop target).
import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:persona_agent_flutter/persona_agent_flutter.dart';

const _baseUrl = 'http://localhost:3000/api/v1';
const _agentId = 'your-agent-id';
const String? _authToken = null;

void main() => runApp(const PersonaExampleApp());

class PersonaExampleApp extends StatelessWidget {
  const PersonaExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'persona_agent_flutter example',
      theme: ThemeData(useMaterial3: true, extensions: const [PersonaChatTheme.light]),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        extensions: const [PersonaChatTheme.dark],
      ),
      home: const ChatPage(),
    );
  }
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late final PersonaChatController _controller;

  @override
  void initState() {
    super.initState();
    _controller = PersonaChatController(
      config: PersonaConfig(baseUrl: _baseUrl, getAuthToken: () => _authToken),
      agentId: _agentId,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Persona')),
      body: SafeArea(child: PersonaChatView(controller: _controller)),
    );
  }
}
