import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/persona_chat_theme.dart';

/// Renders assistant message content as Markdown (bold/italic/lists/links/
/// tables/code blocks), with a copy button on fenced code blocks — mirrors
/// `PersonaMarkdown.tsx`'s `CodeBlock` component. Math/LaTeX rendering
/// (the TS source's KaTeX support) is deliberately not included in this
/// first release — most Persona conversations are general chat, not
/// math-heavy, and it's a straightforward addition later (e.g.
/// `flutter_math_fork`) without touching this widget's public API.
class PersonaMarkdown extends StatelessWidget {
  const PersonaMarkdown({super.key, required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return MarkdownBody(
      data: content,
      selectable: true,
      onTapLink: (text, href, title) {
        if (href == null) return;
        launchUrl(Uri.parse(href), mode: LaunchMode.externalApplication);
      },
      builders: {'code': _CodeBlockBuilder(theme: theme)},
      styleSheet: MarkdownStyleSheet(
        p: TextStyle(color: theme.text, fontSize: 14, height: 1.6),
        h1: TextStyle(color: theme.text, fontSize: 20, fontWeight: FontWeight.bold),
        h2: TextStyle(color: theme.text, fontSize: 18, fontWeight: FontWeight.bold),
        h3: TextStyle(color: theme.text, fontSize: 16, fontWeight: FontWeight.bold),
        strong: TextStyle(color: theme.text, fontWeight: FontWeight.bold),
        em: TextStyle(color: theme.text, fontStyle: FontStyle.italic),
        listBullet: TextStyle(color: theme.text),
        blockquote: TextStyle(color: theme.text.withValues(alpha: 0.75)),
        blockquoteDecoration: BoxDecoration(
          border: Border(left: BorderSide(color: theme.border, width: 3)),
        ),
        code: TextStyle(
          color: theme.text,
          fontFamily: 'monospace',
          backgroundColor: theme.card,
          fontSize: 13,
        ),
        codeblockDecoration: BoxDecoration(
          color: const Color(0xFF09090B),
          borderRadius: BorderRadius.circular(12),
        ),
        a: TextStyle(color: Colors.blue.shade400, decoration: TextDecoration.underline),
        tableBorder: TableBorder.all(color: theme.border),
        tableHead: TextStyle(color: theme.text, fontWeight: FontWeight.bold),
        tableBody: TextStyle(color: theme.text),
      ),
    );
  }
}

/// Renders fenced code blocks with a language label + copy button, matching
/// `PersonaMarkdown.tsx`'s `CodeBlock`. `flutter_markdown_plus` treats
/// inline `code` and fenced code blocks identically at the element-builder
/// level (both are `code` elements) — distinguished here by the presence of
/// a `lang-*` class, which only fenced blocks carry.
class _CodeBlockBuilder extends MarkdownElementBuilder {
  _CodeBlockBuilder({required this.theme});

  final PersonaChatTheme theme;

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    dynamic element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final className = element.attributes['class'] as String?;
    final isFenced = className != null && className.startsWith('language-');
    if (!isFenced) return null; // inline code — let the default styling handle it

    final language = className.substring('language-'.length);
    final code = element.textContent;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF09090B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (language.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 12, top: 8),
                  child: Text(
                    language,
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              const Spacer(),
              IconButton(
                iconSize: 16,
                color: Colors.white54,
                icon: const Icon(Icons.copy_rounded),
                tooltip: 'Copy code',
                onPressed: () => Clipboard.setData(ClipboardData(text: code)),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Text(
                code,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
