import 'package:flutter/material.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';

class ChatInputBar extends StatefulWidget {
  const ChatInputBar({
    super.key,
    required this.onSend,
    this.isStreaming = false,
    this.onCancel,
  });

  final void Function(String) onSend;
  final bool isStreaming;
  final VoidCallback? onCancel;

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  final _controller = TextEditingController();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final has = _controller.text.trim().isNotEmpty;
      if (has != _hasText) setState(() => _hasText = has);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty || widget.isStreaming) return;
    _controller.clear();
    widget.onSend(text);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 8,
        bottom: MediaQuery.viewInsetsOf(context).bottom > 0
            ? 8
            : MediaQuery.paddingOf(context).bottom + 8,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        border: Border(
          top: BorderSide(
            color:
                isDark ? AppColors.dividerDark : AppColors.dividerLight,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 120),
              child: TextField(
                controller: _controller,
                enabled: !widget.isStreaming,
                maxLines: null,
                textInputAction: TextInputAction.newline,
                style: AppTypography.bodyMedium.copyWith(
                  color: isDark
                      ? AppColors.textPrimaryDark
                      : AppColors.textPrimaryLight,
                ),
                decoration: InputDecoration(
                  hintText: widget.isStreaming
                      ? 'Agent is responding…'
                      : 'Message',
                  hintStyle: AppTypography.bodyMedium.copyWith(
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                  filled: true,
                  fillColor: isDark
                      ? AppColors.inputFillDark
                      : AppColors.inputFillLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _SendButton(
            isStreaming: widget.isStreaming,
            hasText: _hasText,
            onSend: _submit,
            onCancel: widget.onCancel,
            isDark: isDark,
          ),
        ],
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.isStreaming,
    required this.hasText,
    required this.onSend,
    required this.isDark,
    this.onCancel,
  });

  final bool isStreaming;
  final bool hasText;
  final VoidCallback onSend;
  final VoidCallback? onCancel;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    if (isStreaming) {
      return _CircleButton(
        onTap: onCancel ?? () {},
        isDark: isDark,
        child: Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );
    }

    return _CircleButton(
      onTap: hasText ? onSend : null,
      isDark: isDark,
      child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 20),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.child,
    required this.isDark,
    this.onTap,
  });

  final Widget child;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = isDark ? AppColors.primaryDark : AppColors.primaryLight;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: onTap != null ? color : color.withValues(alpha: 0.3),
          shape: BoxShape.circle,
        ),
        child: Center(child: child),
      ),
    );
  }
}
