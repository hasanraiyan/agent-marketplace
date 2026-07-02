import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/message_model.dart';
import '../../data/services/agui_service.dart';
import 'thread_provider.dart';

// ── In-memory tool-call state ─────────────────────────────────────────────────

class ToolCallState {
  const ToolCallState({
    required this.id,
    required this.name,
    this.args = '',
    this.status = ToolCallStatus.running,
  });

  final String id;
  final String name;
  final String args;
  final ToolCallStatus status;

  ToolCallState copyWith({String? args, ToolCallStatus? status}) {
    return ToolCallState(
      id: id,
      name: name,
      args: args ?? this.args,
      status: status ?? this.status,
    );
  }
}

enum ToolCallStatus { running, done, error }

// ── Chat state ────────────────────────────────────────────────────────────────

class ChatState {
  const ChatState({
    this.messages = const [],
    this.activeToolCalls = const [],
    this.streamingContent = '',
    this.isStreaming = false,
    this.isLoadingHistory = false,
    this.error,
  });

  final List<MessageModel> messages;
  final List<ToolCallState> activeToolCalls;
  final String streamingContent;
  final bool isStreaming;
  final bool isLoadingHistory;
  final String? error;

  ChatState copyWith({
    List<MessageModel>? messages,
    List<ToolCallState>? activeToolCalls,
    String? streamingContent,
    bool? isStreaming,
    bool? isLoadingHistory,
    String? error,
    bool clearError = false,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      activeToolCalls: activeToolCalls ?? this.activeToolCalls,
      streamingContent: streamingContent ?? this.streamingContent,
      isStreaming: isStreaming ?? this.isStreaming,
      isLoadingHistory: isLoadingHistory ?? this.isLoadingHistory,
      error: clearError ? null : error ?? this.error,
    );
  }
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ChatNotifier extends Notifier<ChatState> {
  ChatNotifier(this._threadId);

  final String _threadId;
  final _aguiService = AguiService();
  StreamSubscription<dynamic>? _subscription;
  String? _agentId;

  @override
  ChatState build() {
    ref.onDispose(() => _subscription?.cancel());
    Future.microtask(loadHistory);
    return const ChatState(isLoadingHistory: true);
  }

  Future<void> loadHistory() async {
    try {
      final resp = await ref
          .read(threadDatasourceProvider)
          .getThreadMessages(_threadId);
      state = state.copyWith(
        messages: resp.data ?? [],
        isLoadingHistory: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingHistory: false,
        error: e.toString(),
      );
    }
  }

  void setAgentId(String id) => _agentId = id;

  Future<void> sendMessage(String content) async {
    if (state.isStreaming || content.trim().isEmpty) return;

    final userMsg = MessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      role: 'user',
      content: content,
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      activeToolCalls: [],
      clearError: true,
    );

    String accumulatedContent = '';

    try {
      final stream = _aguiService.streamMessage(
        agentId: _agentId ?? '',
        threadId: _threadId,
        message: content,
      );

      _subscription = stream.listen(
        (event) => _handleEvent(event, (c) => accumulatedContent = c),
        onDone: () {
          if (accumulatedContent.isNotEmpty) {
            final aiMsg = MessageModel(
              id: DateTime.now().millisecondsSinceEpoch.toString(),
              role: 'assistant',
              content: accumulatedContent,
              timestamp: DateTime.now(),
            );
            state = state.copyWith(
              messages: [...state.messages, aiMsg],
              streamingContent: '',
              isStreaming: false,
              activeToolCalls: [],
            );
          } else {
            state = state.copyWith(
              streamingContent: '',
              isStreaming: false,
              activeToolCalls: [],
            );
          }
        },
        onError: (e) {
          state = state.copyWith(
            isStreaming: false,
            error: e.toString(),
            streamingContent: '',
          );
        },
        cancelOnError: true,
      );
    } catch (e) {
      state = state.copyWith(isStreaming: false, error: e.toString());
    }
  }

  void _handleEvent(
    dynamic event,
    void Function(String) onContentAccumulated,
  ) {
    if (event is! AguiEvent) return;

    switch (event.type) {
      case AguiEventType.textMessageContent:
        final delta = event.delta ?? '';
        final updated = state.streamingContent + delta;
        state = state.copyWith(streamingContent: updated);
        onContentAccumulated(updated);

      case AguiEventType.textMessageEnd:
        break;

      case AguiEventType.toolCallStart:
        final tool = ToolCallState(
          id: event.toolCallId ?? '',
          name: event.toolName ?? 'tool',
        );
        state = state.copyWith(
          activeToolCalls: [...state.activeToolCalls, tool],
        );

      case AguiEventType.toolCallArgs:
        final id = event.toolCallId ?? '';
        final updated = state.activeToolCalls.map((t) {
          return t.id == id
              ? t.copyWith(args: t.args + (event.args ?? ''))
              : t;
        }).toList();
        state = state.copyWith(activeToolCalls: updated);

      case AguiEventType.toolCallEnd:
        final id = event.toolCallId ?? '';
        final updated = state.activeToolCalls.map((t) {
          return t.id == id ? t.copyWith(status: ToolCallStatus.done) : t;
        }).toList();
        state = state.copyWith(activeToolCalls: updated);

      case AguiEventType.runError:
        state = state.copyWith(
          isStreaming: false,
          error: event.error ?? 'Agent encountered an error',
        );

      default:
        break;
    }
  }

  void cancelStream() {
    _subscription?.cancel();
    state = state.copyWith(
      isStreaming: false,
      streamingContent: '',
      activeToolCalls: [],
    );
  }
}

final chatProvider =
    NotifierProvider.family<ChatNotifier, ChatState, String>(
  ChatNotifier.new,
);
