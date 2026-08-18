import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';

/// Thread list sidebar — mirrors `PersonaSidebar.tsx`. Scoped to a Flutter
/// `Drawer` rather than a persistent side panel; a wide-layout host can
/// still lay this out inline (it's a plain widget, not tied to `Scaffold`
/// drawer mechanics).
class PersonaSidebar extends StatelessWidget {
  const PersonaSidebar({
    super.key,
    required this.threads,
    this.activeThreadId,
    required this.onSelectThread,
    required this.onCreateThread,
    this.onDeleteThread,
    this.onRenameThread,
    this.isLoading = false,
  });

  final List<PersonaThread> threads;
  final String? activeThreadId;
  final ValueChanged<String> onSelectThread;
  final VoidCallback onCreateThread;
  final ValueChanged<String>? onDeleteThread;
  final void Function(String id, String title)? onRenameThread;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return Drawer(
      backgroundColor: theme.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: FilledButton.icon(
                onPressed: onCreateThread,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('New chat'),
                style: FilledButton.styleFrom(backgroundColor: theme.primary, foregroundColor: theme.primaryText),
              ),
            ),
            Expanded(
              child: isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : threads.isEmpty
                  ? Center(
                      child: Text('No conversations yet', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 12)),
                    )
                  : ListView.builder(
                      itemCount: threads.length,
                      itemBuilder: (context, index) {
                        final thread = threads[index];
                        final isActive = thread.id == activeThreadId;
                        return ListTile(
                          dense: true,
                          selected: isActive,
                          selectedTileColor: theme.card,
                          title: Text(
                            thread.title ?? 'Untitled',
                            style: TextStyle(color: theme.text, fontSize: 13, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal),
                            overflow: TextOverflow.ellipsis,
                          ),
                          onTap: () => onSelectThread(thread.id),
                          trailing: onDeleteThread == null
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 16),
                                  color: theme.text.withValues(alpha: 0.4),
                                  onPressed: () => onDeleteThread!(thread.id),
                                ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
