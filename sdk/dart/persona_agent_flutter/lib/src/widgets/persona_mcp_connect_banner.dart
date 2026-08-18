import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/persona_chat_theme.dart';

/// Shows a "Connect" prompt for every user-mode MCP an agent needs that the
/// caller hasn't authorized yet — mirrors `PersonaMcpConnectBanner.tsx`.
/// Renders nothing when [connections] is empty.
class PersonaMcpConnectBanner extends StatelessWidget {
  const PersonaMcpConnectBanner({super.key, required this.connections});

  final List<PersonaMcpConnection> connections;

  @override
  Widget build(BuildContext context) {
    if (connections.isEmpty) return const SizedBox.shrink();
    final theme = PersonaChatTheme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final connection in connections)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  const Icon(Icons.link_rounded, size: 16, color: Colors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Connect ${connection.name} to use this agent\'s full capabilities',
                      style: TextStyle(color: theme.text, fontSize: 12),
                    ),
                  ),
                  TextButton(
                    onPressed: connection.authorizeUrl == null
                        ? null
                        : () => launchUrl(
                            Uri.parse(connection.authorizeUrl!),
                            mode: LaunchMode.externalApplication,
                          ),
                    child: const Text('Connect'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
