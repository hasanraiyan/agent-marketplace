import 'package:flutter/material.dart';

import '../../theme/persona_chat_theme.dart';

/// A dark, line-numbered code viewer for a `read_file`/`view_file` tool
/// call's result.
class PersonaReadFileCard extends StatelessWidget {
  const PersonaReadFileCard({super.key, required this.filePath, required this.content, required this.done});

  final String filePath;
  final String content;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    if (!done) {
      return _Frame(
        theme: theme,
        filePath: filePath,
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    if (content.isEmpty) {
      return _Frame(
        theme: theme,
        filePath: filePath,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Center(
            child: Text('Empty file', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 11)),
          ),
        ),
      );
    }

    final lines = content.split('\n');
    if (lines.length > 1 && lines.last.isEmpty) lines.removeLast();

    return _Frame(
      theme: theme,
      filePath: filePath,
      child: Container(
        color: const Color(0xFF0D1117),
        constraints: const BoxConstraints(maxHeight: 320),
        child: SingleChildScrollView(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < lines.length; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 32,
                            child: Text(
                              '${i + 1}',
                              textAlign: TextAlign.right,
                              style: const TextStyle(color: Color(0xFF6E7681), fontSize: 11, fontFamily: 'monospace'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            lines[i].isEmpty ? ' ' : lines[i],
                            style: const TextStyle(color: Color(0xFFE6EDF2), fontSize: 11.5, fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Frame extends StatelessWidget {
  const _Frame({required this.theme, required this.filePath, required this.child});

  final PersonaChatTheme theme;
  final String filePath;
  final Widget child;

  @override
  Widget build(BuildContext context) {
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
                Icon(Icons.description_outlined, size: 16, color: theme.text.withValues(alpha: 0.6)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    filePath,
                    style: TextStyle(color: theme.text, fontSize: 12, fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}
