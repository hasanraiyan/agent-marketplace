import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme/persona_chat_theme.dart';
import '../../utils/tool_presentation.dart';

class PersonaSearchResultsCard extends StatelessWidget {
  const PersonaSearchResultsCard({super.key, required this.results, required this.done});

  final List<PersonaSearchResult> results;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    if (!done) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('SEARCHING...', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Container(height: 32, decoration: BoxDecoration(color: theme.border.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(12))),
        ],
      );
    }

    if (results.isEmpty) {
      return Text('No search results found.', style: TextStyle(color: theme.text.withValues(alpha: 0.6), fontStyle: FontStyle.italic, fontSize: 12));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('SEARCH RESULTS', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        for (final result in results)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: InkWell(
              onTap: result.url == null ? null : () => launchUrl(Uri.parse(result.url!), mode: LaunchMode.externalApplication),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(border: Border.all(color: theme.border), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        result.title ?? result.url ?? '',
                        style: TextStyle(color: theme.text, fontSize: 12, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (result.url != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: Text(
                          getDomain(result.url!),
                          style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
