import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../presentation/providers/chat_provider.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.role,
    required this.content,
    this.isStreaming = false,
  });

  final String role;
  final String content;
  final bool isStreaming;

  bool get _isUser => role == 'user';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.sizeOf(context);
    final maxWidth = size.width * (size.width >= 600 ? 0.6 : 0.78);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment:
            _isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!_isUser) ...[
            _AgentAvatar(isDark: isDark),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: _isUser
                  ? _UserBubble(content: content, isDark: isDark)
                  : _AssistantBubble(
                      content: content,
                      isDark: isDark,
                      isStreaming: isStreaming,
                    ),
            ),
          ),
          if (_isUser) const SizedBox(width: 8),
        ],
      ),
    );
  }
}

// ── User bubble ───────────────────────────────────────────────────────────────

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.content, required this.isDark});

  final String content;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? AppColors.primaryDark : AppColors.primaryLight;

    return GestureDetector(
      onLongPress: () {
        Clipboard.setData(ClipboardData(text: content));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Copied to clipboard'),
            duration: Duration(seconds: 1),
          ),
        );
      },
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(4),
          ),
        ),
        child: Text(
          content,
          style: AppTypography.bodyMedium.copyWith(color: Colors.white),
        ),
      ),
    );
  }
}

// ── Assistant bubble ──────────────────────────────────────────────────────────

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({
    required this.content,
    required this.isDark,
    required this.isStreaming,
  });

  final String content;
  final bool isDark;
  final bool isStreaming;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? AppColors.cardDark : AppColors.cardLight;
    final textColor = isDark
        ? AppColors.textPrimaryDark
        : AppColors.textPrimaryLight;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(4),
          topRight: Radius.circular(16),
          bottomLeft: Radius.circular(16),
          bottomRight: Radius.circular(16),
        ),
        border: Border.all(
          color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MarkdownBody(
            data: content.isEmpty ? ' ' : content,
            styleSheet: MarkdownStyleSheet(
              p: AppTypography.bodyMedium.copyWith(color: textColor),
              code: AppTypography.mono.copyWith(
                backgroundColor: isDark
                    ? AppColors.inputFillDark
                    : AppColors.inputFillLight,
              ),
              codeblockDecoration: BoxDecoration(
                color:
                    isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
                borderRadius: BorderRadius.circular(8),
              ),
              blockquoteDecoration: BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: isDark
                        ? AppColors.primaryDark
                        : AppColors.primaryLight,
                    width: 3,
                  ),
                ),
              ),
            ),
            selectable: true,
          ),
          if (isStreaming) ...[
            const SizedBox(height: 4),
            _TypingCursor(isDark: isDark),
          ],
        ],
      ),
    );
  }
}

// ── Typing cursor ─────────────────────────────────────────────────────────────

class _TypingCursor extends StatefulWidget {
  const _TypingCursor({required this.isDark});
  final bool isDark;

  @override
  State<_TypingCursor> createState() => _TypingCursorState();
}

class _TypingCursorState extends State<_TypingCursor>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, _) => Opacity(
        opacity: _ctrl.value,
        child: Container(
          width: 2,
          height: 16,
          decoration: BoxDecoration(
            color: widget.isDark
                ? AppColors.primaryDark
                : AppColors.primaryLight,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
      ),
    );
  }
}

// ── Tool call chip ────────────────────────────────────────────────────────────

class ToolCallChip extends StatelessWidget {
  const ToolCallChip({super.key, required this.tool});

  final ToolCallState tool;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (tool.status) {
      ToolCallStatus.running => (Icons.autorenew_rounded, AppColors.warning),
      ToolCallStatus.done => (Icons.check_circle_rounded, AppColors.success),
      ToolCallStatus.error => (Icons.error_rounded, AppColors.error),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (tool.status == ToolCallStatus.running)
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: color,
              ),
            )
          else
            Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            tool.name,
            style: AppTypography.labelSmall.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

// ── Three-dot typing indicator ────────────────────────────────────────────────

class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          _AgentAvatar(isDark: isDark),
          const SizedBox(width: 8),
          AnimatedBuilder(
            animation: _ctrl,
            builder: (_, _) => Row(
              children: List.generate(3, (i) {
                final delay = i * 0.2;
                final t = (_ctrl.value - delay).clamp(0.0, 0.5) * 2;
                final opacity = 0.3 + 0.7 * (t < 0.5 ? t * 2 : (1 - t) * 2);
                return Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Opacity(
                    opacity: opacity,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _AgentAvatar extends StatelessWidget {
  const _AgentAvatar({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        Icons.auto_awesome_rounded,
        size: 16,
        color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
      ),
    );
  }
}
