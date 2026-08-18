import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import 'persona_markdown.dart';

/// One chat bubble — user messages right-aligned on [PersonaChatTheme.primary]
/// as plain text, assistant messages left-aligned on [PersonaChatTheme.card]
/// rendered as Markdown ([PersonaMarkdown]). An empty, still-streaming
/// assistant message (the placeholder appended the instant `sendMessage` is
/// called, before any text has arrived) shows a typing indicator instead of
/// blank space.
///
/// This renders [PersonaMessage.content] only — a message's `toolCalls` are
/// a separate concern (see [PersonaMessageFeed]/`groupToolCalls`, rendered
/// alongside this bubble, not inside it).
class PersonaMessageBubble extends StatelessWidget {
  const PersonaMessageBubble({
    super.key,
    required this.message,
    this.showUserAvatar = true,
    this.showAssistantAvatar = true,
    this.userAvatar,
    this.assistantAvatar,
  });

  final PersonaMessage message;

  /// @default true
  final bool showUserAvatar;

  /// @default true
  final bool showAssistantAvatar;

  /// Replaces the default user-icon avatar entirely (e.g. a profile picture).
  final Widget? userAvatar;

  /// Replaces the default bot-icon avatar entirely.
  final Widget? assistantAvatar;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final isUser = message.role == PersonaRole.user;
    final textColor = isUser ? theme.primaryText : theme.text;
    final showAvatar = isUser ? showUserAvatar : showAssistantAvatar;

    final bubble = Flexible(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isUser ? theme.primary : theme.card,
          borderRadius: BorderRadius.circular(16),
          border: isUser ? null : Border.all(color: theme.border),
        ),
        child: message.content.isEmpty && message.isStreaming
            ? _TypingIndicator(color: textColor)
            : isUser
            ? SelectableText(message.content, style: TextStyle(color: textColor, fontSize: 14, height: 1.5))
            : PersonaMarkdown(content: message.content),
      ),
    );

    final avatar = showAvatar
        ? Padding(
            padding: EdgeInsets.only(left: isUser ? 8 : 0, right: isUser ? 0 : 8),
            child: (isUser ? userAvatar : assistantAvatar) ?? _DefaultAvatar(isUser: isUser, theme: theme),
          )
        : null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: isUser
            ? [bubble, if (avatar != null) avatar]
            : [if (avatar != null) avatar, bubble],
      ),
    );
  }
}

class _DefaultAvatar extends StatelessWidget {
  const _DefaultAvatar({required this.isUser, required this.theme});

  final bool isUser;
  final PersonaChatTheme theme;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 14,
      backgroundColor: theme.border,
      child: Icon(isUser ? Icons.person_outline : Icons.smart_toy_outlined, size: 15, color: theme.text.withValues(alpha: 0.7)),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator({required this.color});

  final Color color;

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      height: 14,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(3, (i) {
              final t = ((_controller.value - i * 0.2) % 1.0).clamp(0.0, 1.0);
              final opacity = (0.3 + 0.7 * (1 - (t - 0.5).abs() * 2)).clamp(0.0, 1.0);
              return Opacity(
                opacity: opacity,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}
