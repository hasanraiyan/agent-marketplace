import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import '../utils/tool_grouping.dart';
import 'persona_message_bubble.dart';
import 'persona_skeleton.dart';
import 'persona_tool_group.dart';
import 'persona_tool_trace.dart';

/// The scrollable message list — composes [PersonaMessageBubble] with each
/// message's tool calls (via [PersonaToolGroup]/[PersonaToolTrace]) and
/// reasoning text. Mirrors `PersonaMessageFeed.tsx`.
class PersonaMessageFeed extends StatelessWidget {
  const PersonaMessageFeed({
    super.key,
    required this.messages,
    this.isStreaming = false,
    this.isLoading = false,
    this.error,
    this.toolRenderers,
    this.onOpenFile,
    this.groupTools = true,
    this.clusterLabels,
    this.greeting = 'How can I assist you today?',
    this.scrollController,
    this.padding = const EdgeInsets.all(16),
    this.showUserAvatar = true,
    this.showAssistantAvatar = true,
    this.userAvatar,
    this.assistantAvatar,
  });

  final List<PersonaMessage> messages;
  final bool isStreaming;
  final bool isLoading;
  final Object? error;
  final Map<String, PersonaToolRenderer>? toolRenderers;
  final ValueChanged<String>? onOpenFile;

  /// Clusters consecutive tool calls into one collapsible group instead of
  /// one card each. @default true
  final bool groupTools;
  final Map<String, PersonaToolClusterMeta>? clusterLabels;
  final String greeting;
  final ScrollController? scrollController;
  final EdgeInsetsGeometry padding;
  final bool showUserAvatar;
  final bool showAssistantAvatar;
  final Widget? userAvatar;
  final Widget? assistantAvatar;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    if (isLoading) {
      return ListView(
        padding: padding,
        children: const [
          PersonaMessageSkeleton(),
          PersonaMessageSkeleton(isUser: true),
          PersonaMessageSkeleton(),
        ],
      );
    }

    if (messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            greeting,
            textAlign: TextAlign.center,
            style: TextStyle(color: theme.text.withValues(alpha: 0.6), fontSize: 16),
          ),
        ),
      );
    }

    return ListView.builder(
      controller: scrollController,
      padding: padding,
      itemCount: messages.length + (error != null ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == messages.length) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('⚠️ $error', style: const TextStyle(color: Colors.red, fontSize: 12)),
          );
        }

        final message = messages[index];
        final isLastMessage = index == messages.length - 1;
        final isLive = isStreaming && isLastMessage;
        final toolCalls = message.toolCalls ?? const [];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (toolCalls.isNotEmpty)
              if (groupTools)
                for (final item in groupToolCalls(toolCalls))
                  switch (item) {
                    PersonaToolGroupSingle(tool: final tool) => PersonaToolTrace(
                      key: ValueKey(tool.toolCallId),
                      toolCall: tool,
                      toolRenderers: toolRenderers,
                      onOpenFile: onOpenFile,
                      isLive: isLive,
                    ),
                    PersonaToolGroupCluster(tools: final tools) => PersonaToolGroup(
                      key: ValueKey(tools.first.toolCallId),
                      tools: tools,
                      toolRenderers: toolRenderers,
                      onOpenFile: onOpenFile,
                      clusterLabels: clusterLabels,
                      isLive: isLive,
                    ),
                  }
              else
                for (final tool in toolCalls)
                  PersonaToolTrace(
                    key: ValueKey(tool.toolCallId),
                    toolCall: tool,
                    toolRenderers: toolRenderers,
                    onOpenFile: onOpenFile,
                    isLive: isLive,
                  ),
            if (message.reasoning != null && message.reasoning!.isNotEmpty) _ReasoningBlock(message: message),
            if (message.content.isNotEmpty || message.role == PersonaRole.user || (isLive && toolCalls.isEmpty))
              PersonaMessageBubble(
                message: message,
                showUserAvatar: showUserAvatar,
                showAssistantAvatar: showAssistantAvatar,
                userAvatar: userAvatar,
                assistantAvatar: assistantAvatar,
              ),
          ],
        );
      },
    );
  }
}

class _ReasoningBlock extends StatefulWidget {
  const _ReasoningBlock({required this.message});
  final PersonaMessage message;

  @override
  State<_ReasoningBlock> createState() => _ReasoningBlockState();
}

class _ReasoningBlockState extends State<_ReasoningBlock> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.psychology_outlined, size: 14, color: theme.text.withValues(alpha: 0.4)),
                const SizedBox(width: 6),
                Text(
                  widget.message.isReasoning ? 'Thinking…' : 'Thought process',
                  style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 11, fontStyle: FontStyle.italic),
                ),
                Icon(_open ? Icons.expand_less : Icons.expand_more, size: 14, color: theme.text.withValues(alpha: 0.4)),
              ],
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 20),
              child: Text(
                widget.message.reasoning ?? '',
                style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 12, fontStyle: FontStyle.italic),
              ),
            ),
        ],
      ),
    );
  }
}
