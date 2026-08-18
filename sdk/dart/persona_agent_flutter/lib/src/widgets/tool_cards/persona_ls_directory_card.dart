import 'package:flutter/material.dart';

import '../../theme/persona_chat_theme.dart';
import '../../utils/tool_presentation.dart';

class PersonaLsDirectoryCard extends StatelessWidget {
  const PersonaLsDirectoryCard({super.key, required this.path, required this.entries, required this.done});

  final String path;
  final List<PersonaLsEntry> entries;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return Container(
      decoration: BoxDecoration(border: Border.all(color: theme.border), borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: theme.card,
            child: Row(
              children: [
                Icon(Icons.folder_outlined, size: 16, color: Colors.amber.shade600),
                const SizedBox(width: 8),
                Expanded(child: Text(path, style: TextStyle(color: theme.text, fontSize: 12, fontWeight: FontWeight.w600))),
              ],
            ),
          ),
          if (!done)
            const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
          else if (entries.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('Empty directory', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 11))),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 240),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: entries.length,
                separatorBuilder: (_, _) => Divider(height: 1, color: theme.border),
                itemBuilder: (context, index) {
                  final entry = entries[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Row(
                      children: [
                        Icon(
                          entry.isDir ? Icons.folder_outlined : Icons.description_outlined,
                          size: 16,
                          color: entry.isDir ? Colors.amber.shade600 : theme.text.withValues(alpha: 0.5),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(entry.name, style: TextStyle(color: theme.text, fontSize: 12, fontFamily: 'monospace')),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
