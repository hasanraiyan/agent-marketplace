import 'package:flutter/material.dart';

import '../../theme/persona_chat_theme.dart';
import '../../utils/tool_presentation.dart';

class PersonaFileDiffCard extends StatelessWidget {
  const PersonaFileDiffCard({
    super.key,
    required this.filePath,
    required this.oldContent,
    required this.newContent,
    this.note,
  });

  final String filePath;
  final String oldContent;
  final String newContent;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final rows = computeLineDiff(oldContent.split('\n'), newContent.split('\n'));
    final added = rows.where((r) => r.type == DiffRowType.add).length;
    final removed = rows.where((r) => r.type == DiffRowType.remove).length;

    return Container(
      decoration: BoxDecoration(border: Border.all(color: theme.border), borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (filePath.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              color: theme.card,
              child: Row(
                children: [
                  Expanded(
                    child: Text(filePath, style: TextStyle(color: theme.text, fontSize: 12, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                  ),
                  Text('+$added', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 11)),
                  const SizedBox(width: 6),
                  Text('-$removed', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 11)),
                ],
              ),
            ),
          if (note != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              color: theme.card.withValues(alpha: 0.5),
              child: Text(note!, style: TextStyle(color: theme.text.withValues(alpha: 0.6), fontSize: 10)),
            ),
          Container(
            constraints: const BoxConstraints(maxHeight: 320),
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final row in rows)
                      Container(
                        color: switch (row.type) {
                          DiffRowType.add => Colors.green.withValues(alpha: 0.08),
                          DiffRowType.remove => Colors.red.withValues(alpha: 0.08),
                          DiffRowType.context => null,
                        },
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 16,
                              child: Text(
                                switch (row.type) {
                                  DiffRowType.add => '+',
                                  DiffRowType.remove => '-',
                                  DiffRowType.context => '',
                                },
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  color: switch (row.type) {
                                    DiffRowType.add => Colors.green,
                                    DiffRowType.remove => Colors.red,
                                    DiffRowType.context => theme.text.withValues(alpha: 0.3),
                                  },
                                ),
                              ),
                            ),
                            Text(
                              row.line.isEmpty ? ' ' : row.line,
                              style: TextStyle(color: theme.text, fontFamily: 'monospace', fontSize: 11.5),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
