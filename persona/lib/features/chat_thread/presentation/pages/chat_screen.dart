import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../providers/chat_provider.dart';
import '../providers/thread_provider.dart';
import '../widgets/chat_input_bar.dart';
import '../widgets/message_bubble.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    required this.threadId,
    required this.agentId,
  });

  final String threadId;
  final String agentId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(chatProvider(widget.threadId).notifier).setAgentId(widget.agentId);
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        if (animated) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        } else {
          _scrollController.jumpTo(
            _scrollController.position.maxScrollExtent,
          );
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final chatState = ref.watch(chatProvider(widget.threadId));
    final thread = ref.watch(
      threadListProvider.select((s) =>
          s.value?.firstWhere((t) => t.id == widget.threadId,
              orElse: () => s.value!.first)),
    );

    // Scroll to bottom when new messages arrive
    ref.listen(chatProvider(widget.threadId), (prev, next) {
      if (prev?.messages.length != next.messages.length ||
          next.streamingContent.isNotEmpty) {
        _scrollToBottom();
      }
    });

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: _buildAppBar(context, isDark, thread?.title),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 600;
          return Column(
            children: [
              // Error banner
              if (chatState.error != null)
                _ErrorBanner(
                  message: chatState.error!,
                  isDark: isDark,
                  onDismiss: () =>
                      ref.read(chatProvider(widget.threadId).notifier).cancelStream(),
                ),
              Expanded(
                child: _buildMessageList(context, isDark, r, chatState, isWide),
              ),
              ChatInputBar(
                isStreaming: chatState.isStreaming,
                onSend: (msg) {
                  ref.read(chatProvider(widget.threadId).notifier).sendMessage(msg);
                },
                onCancel: () =>
                    ref.read(chatProvider(widget.threadId).notifier).cancelStream(),
              ),
            ],
          );
        },
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context, bool isDark, String? title) {
    return AppBar(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      surfaceTintColor: Colors.transparent,
      leading: const BackButton(),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title ?? 'Chat',
            style: AppTypography.titleMedium.copyWith(
              color: isDark
                  ? AppColors.textPrimaryDark
                  : AppColors.textPrimaryLight,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.edit_rounded),
          onPressed: () => _showRenameSheet(context),
          tooltip: 'Rename',
        ),
      ],
    );
  }

  Widget _buildMessageList(
    BuildContext context,
    bool isDark,
    Responsive r,
    ChatState chatState,
    bool isWide,
  ) {
    if (chatState.isLoadingHistory) {
      return const Center(child: CircularProgressIndicator());
    }

    final messages = chatState.messages;
    final isStreaming = chatState.isStreaming;
    final streamContent = chatState.streamingContent;
    final tools = chatState.activeToolCalls;

    if (messages.isEmpty && !isStreaming) {
      return EmptyState(
        icon: Icons.chat_bubble_outline_rounded,
        title: 'Start the conversation',
        subtitle: 'Send a message to begin',
      );
    }

    final horizontalPadding = isWide ? r.horizontalPadding * 2 : r.horizontalPadding;

    return Stack(
      children: [
        ListView.builder(
          controller: _scrollController,
          padding: EdgeInsets.symmetric(
            horizontal: horizontalPadding,
            vertical: 12,
          ),
          itemCount: messages.length +
              (isStreaming && streamContent.isNotEmpty ? 1 : 0) +
              (isStreaming && streamContent.isEmpty && tools.isEmpty ? 1 : 0) +
              (tools.isNotEmpty ? 1 : 0),
          itemBuilder: (context, i) {
            // Show typing indicator before stream starts
            if (i == messages.length &&
                isStreaming &&
                streamContent.isEmpty &&
                tools.isEmpty) {
              return const TypingIndicator();
            }

            // Show active tool calls
            if (i == messages.length &&
                tools.isNotEmpty) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Wrap(
                  spacing: 6,
                  children:
                      tools.map((t) => ToolCallChip(tool: t)).toList(),
                ),
              );
            }

            // Show streaming assistant message
            if (i == messages.length + (tools.isNotEmpty ? 1 : 0) &&
                isStreaming &&
                streamContent.isNotEmpty) {
              return MessageBubble(
                role: 'assistant',
                content: streamContent,
                isStreaming: true,
              );
            }

            final msg = messages[i];
            return MessageBubble(
              role: msg.role,
              content: msg.content,
            );
          },
        ),
        // Scroll-to-bottom FAB
        _ScrollToBottomFab(
          controller: _scrollController,
          isDark: isDark,
          onTap: () => _scrollToBottom(),
        ),
      ],
    );
  }

  Future<void> _showRenameSheet(BuildContext context) async {
    final thread = ref
        .read(threadListProvider)
        .value
        ?.firstWhere((t) => t.id == widget.threadId);
    if (thread == null) return;

    final controller = TextEditingController(text: thread.title);
    final newTitle = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.viewInsetsOf(ctx).bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Rename conversation',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (newTitle != null && newTitle.isNotEmpty && context.mounted) {
      await ref
          .read(threadListProvider.notifier)
          .renameThread(widget.threadId, newTitle);
    }
  }
}

// ── Error banner ──────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
    required this.isDark,
    required this.onDismiss,
  });

  final String message;
  final bool isDark;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.error.withValues(alpha: 0.1),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 18, color: AppColors.error),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodySmall.copyWith(color: AppColors.error),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded,
                size: 18, color: AppColors.error),
            onPressed: onDismiss,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}

// ── Scroll-to-bottom FAB ──────────────────────────────────────────────────────

class _ScrollToBottomFab extends StatefulWidget {
  const _ScrollToBottomFab({
    required this.controller,
    required this.isDark,
    required this.onTap,
  });

  final ScrollController controller;
  final bool isDark;
  final VoidCallback onTap;

  @override
  State<_ScrollToBottomFab> createState() => _ScrollToBottomFabState();
}

class _ScrollToBottomFabState extends State<_ScrollToBottomFab> {
  bool _show = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (!widget.controller.hasClients) return;
    final diff = widget.controller.position.maxScrollExtent -
        widget.controller.position.pixels;
    final show = diff > 200;
    if (show != _show) setState(() => _show = show);
  }

  @override
  Widget build(BuildContext context) {
    if (!_show) return const SizedBox.shrink();

    return Positioned(
      bottom: 12,
      right: 12,
      child: FloatingActionButton.small(
        onPressed: widget.onTap,
        backgroundColor:
            widget.isDark ? AppColors.cardDark : AppColors.cardLight,
        child: Icon(
          Icons.keyboard_arrow_down_rounded,
          color: widget.isDark
              ? AppColors.textPrimaryDark
              : AppColors.textPrimaryLight,
        ),
      ),
    );
  }
}
