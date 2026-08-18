import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../starter_prompt.dart';
import '../theme/persona_chat_theme.dart';
import 'persona_composer.dart';
import 'persona_interrupt_card.dart';
import 'persona_message_feed.dart';
import 'persona_tool_trace.dart';

/// The composition root — message feed + paused-interrupt card + composer,
/// all wired to one [PersonaChatController]. Mirrors `PersonaChatView.tsx`,
/// scoped to what this package builds so far (no sidebar/files-drawer/MCP
/// banner wiring here — those are separate widgets a consumer composes
/// alongside this one, since they each need their own controller).
class PersonaChatView extends StatefulWidget {
  const PersonaChatView({
    super.key,
    required this.controller,
    this.toolRenderers,
    this.onOpenFile,
    this.groupTools = true,
    this.greeting = 'How can I assist you today?',
    this.starterPrompts = const [],
    this.showUserAvatar = true,
    this.showAssistantAvatar = true,
    this.userAvatar,
    this.assistantAvatar,
  });

  final PersonaChatController controller;
  final Map<String, PersonaToolRenderer>? toolRenderers;
  final ValueChanged<String>? onOpenFile;
  final bool groupTools;
  final String greeting;

  /// Quick-action suggestions shown above the composer before the first
  /// message is sent.
  final List<StarterPromptItem> starterPrompts;
  final bool showUserAvatar;
  final bool showAssistantAvatar;
  final Widget? userAvatar;
  final Widget? assistantAvatar;

  @override
  State<PersonaChatView> createState() => _PersonaChatViewState();
}

class _PersonaChatViewState extends State<PersonaChatView> {
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return StreamBuilder<PersonaChatState>(
      stream: widget.controller.stream,
      initialData: widget.controller.state,
      builder: (context, snapshot) {
        final state = snapshot.data ?? widget.controller.state;
        _scrollToBottom();

        return ColoredBox(
          color: theme.background,
          child: Column(
            children: [
              Expanded(
                child: PersonaMessageFeed(
                  messages: state.messages,
                  isStreaming: state.isStreaming,
                  isLoading: state.isLoadingHistory,
                  error: state.error,
                  toolRenderers: widget.toolRenderers,
                  onOpenFile: widget.onOpenFile ?? widget.controller.openWorkspaceFile,
                  groupTools: widget.groupTools,
                  greeting: widget.greeting,
                  scrollController: _scrollController,
                  showUserAvatar: widget.showUserAvatar,
                  showAssistantAvatar: widget.showAssistantAvatar,
                  userAvatar: widget.userAvatar,
                  assistantAvatar: widget.assistantAvatar,
                ),
              ),
              if (state.interrupt != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  child: PersonaInterruptCard(
                    interrupt: state.interrupt!,
                    isStreaming: state.isStreaming,
                    onRespond: (resume, displayContent) =>
                        widget.controller.resumeInterrupt(resume, displayContent),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: PersonaComposer(
                  value: state.input,
                  onChanged: widget.controller.setInput,
                  onSubmit: () => widget.controller.sendMessage(),
                  onStop: widget.controller.stop,
                  isStreaming: state.isStreaming,
                  starterPrompts: state.messages.isEmpty ? widget.starterPrompts : const [],
                  onSelectStarter: (prompt) => widget.controller.sendMessage(prompt),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
