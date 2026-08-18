import 'package:flutter/material.dart';

import '../../theme/persona_chat_theme.dart';
import '../../utils/tool_presentation.dart';

class PersonaGrepResultsCard extends StatelessWidget {
  const PersonaGrepResultsCard({
    super.key,
    required this.query,
    required this.path,
    required this.matches,
    required this.done,
  });

  final String query;
  final String path;
  final List<PersonaGrepMatch> matches;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final groups = <String, List<PersonaGrepMatch>>{};
    for (final match in matches) {
      groups.putIfAbsent(match.file, () => []).add(match);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 6,
          children: [
            Text('GREP:', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
              child: Text('"$query"', style: TextStyle(color: Colors.blue.shade700, fontSize: 11, fontWeight: FontWeight.bold)),
            ),
            Text('in', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 11)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: theme.border.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(6)),
              child: Text(path, style: TextStyle(color: theme.text, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (!done)
          Container(height: 32, decoration: BoxDecoration(color: theme.border.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(12)))
        else if (groups.isEmpty)
          Text('No matches found.', style: TextStyle(color: theme.text.withValues(alpha: 0.6), fontStyle: FontStyle.italic, fontSize: 12))
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final entry in groups.entries)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(border: Border.all(color: theme.border), borderRadius: BorderRadius.circular(12)),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          color: theme.card,
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(entry.key, style: TextStyle(color: theme.text, fontSize: 11, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                              ),
                              Text('${entry.value.length} ${entry.value.length == 1 ? 'match' : 'matches'}', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 9)),
                            ],
                          ),
                        ),
                        for (final match in entry.value)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (match.line > 0)
                                  SizedBox(
                                    width: 28,
                                    child: Text('${match.line}', textAlign: TextAlign.right, style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10, fontFamily: 'monospace')),
                                  ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(match.content, style: TextStyle(color: theme.text.withValues(alpha: 0.8), fontSize: 11, fontFamily: 'monospace')),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 4),
                      ],
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
