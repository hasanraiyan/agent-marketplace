import 'package:flutter/material.dart';

import '../starter_prompt.dart';
import '../theme/persona_chat_theme.dart';

/// The chat input box — mirrors `PersonaComposer.tsx`'s controlled-input +
/// send/stop button toolbar, adapted to Flutter's [TextEditingController]
/// model (React keeps `input` in the parent's state and re-renders the
/// `<textarea>`'s `value`; Flutter owns the controller locally and just
/// notifies the parent via [onChanged] on every keystroke — [value] only
/// needs to be pushed back into the controller when it changes from
/// OUTSIDE this widget, e.g. cleared by [PersonaChatController.sendMessage]
/// after a send).
class PersonaComposer extends StatefulWidget {
  const PersonaComposer({
    super.key,
    required this.value,
    required this.onChanged,
    required this.onSubmit,
    this.onStop,
    this.isStreaming = false,
    this.enabled = true,
    this.placeholder = 'Ask anything...',
    this.starterPrompts = const [],
    this.onSelectStarter,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onStop;
  final bool isStreaming;
  final bool enabled;
  final String placeholder;

  /// Quick-action suggestions shown above the input while it's empty and no
  /// conversation has started yet (pass an empty list once messages exist).
  final List<StarterPromptItem> starterPrompts;
  final ValueChanged<String>? onSelectStarter;

  @override
  State<PersonaComposer> createState() => _PersonaComposerState();
}

class _PersonaComposerState extends State<PersonaComposer> {
  late final TextEditingController _controller = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(covariant PersonaComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.value = _controller.value.copyWith(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canSend => _controller.text.trim().isNotEmpty && !widget.isStreaming;

  void _submit() {
    if (!_canSend) return;
    widget.onSubmit();
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.starterPrompts.isNotEmpty && widget.value.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final item in widget.starterPrompts)
                  ActionChip(
                    label: Text(item.title, style: TextStyle(color: theme.text, fontSize: 11)),
                    avatar: item.icon != null ? Text(item.icon!) : null,
                    backgroundColor: theme.card,
                    side: BorderSide(color: theme.border),
                    onPressed: () => widget.onSelectStarter?.call(item.prompt),
                  ),
              ],
            ),
          ),
        _buildComposerBody(theme),
      ],
    );
  }

  Widget _buildComposerBody(PersonaChatTheme theme) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            onChanged: (value) {
              widget.onChanged(value);
              setState(() {}); // re-evaluate _canSend for the send button
            },
            enabled: widget.enabled,
            minLines: 1,
            maxLines: 6,
            style: TextStyle(color: theme.text, fontSize: 14),
            decoration: InputDecoration(
              hintText: widget.placeholder,
              hintStyle: TextStyle(color: theme.text.withValues(alpha: 0.4)),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (widget.isStreaming)
                IconButton(
                  onPressed: widget.onStop,
                  icon: const Icon(Icons.stop_rounded),
                  style: IconButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                )
              else
                IconButton(
                  onPressed: _canSend ? _submit : null,
                  icon: const Icon(Icons.arrow_upward_rounded),
                  style: IconButton.styleFrom(
                    backgroundColor: theme.primary,
                    foregroundColor: theme.primaryText,
                    disabledBackgroundColor: theme.border,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
