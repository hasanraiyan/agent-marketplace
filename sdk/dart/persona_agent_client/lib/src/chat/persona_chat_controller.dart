import 'dart:async';

import 'package:dio/dio.dart';

import '../config.dart';
import '../controller_base.dart';
import '../exceptions.dart';
import '../http/chat_stream.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import '../wire/wire_parsing.dart';
import 'persona_chat_options.dart';
import 'persona_chat_state.dart';
import 'send_message_override.dart';

/// Port of `useChat.ts` — the whole chat state machine (sending messages,
/// parsing the AG-UI SSE stream, thread reload, interrupts, stop/reload/
/// clear) as a plain, framework-agnostic Dart class. Public API mirrors
/// `useChat`'s returned object one-for-one, with two deliberate deviations:
///
/// - No `handleInputChange`/`handleSubmit` — those exist in the TS source
///   only to adapt DOM form/change events; [setInput] + [sendMessage] cover
///   the same ground without a DOM event type to translate.
/// - `PersonaProvider`/`usePersonaContext()` → a [PersonaConfig] passed
///   explicitly to this constructor, since there's no context-provider
///   equivalent for a plain (non-widget) Dart class. Build one
///   [PersonaConfig] at app root and pass it down.
class PersonaChatController extends PersonaController<PersonaChatState> {
  PersonaChatController({
    required PersonaConfig config,
    this.agentId,
    String? threadId,
    List<PersonaMessage>? initialMessages,
    this.onFinish,
    this.onError,
    this.onEvent,
    Dio? dio,
    ChatStreamOpener? chatStreamOpener,
  }) : _config = config,
       _threadId = threadId,
       _dio = dio ?? createPersonaHttpClient(config),
       super(PersonaChatState(messages: initialMessages ?? const [])) {
    _openChatStream = chatStreamOpener ?? createDioChatStreamOpener(_dio);
    // Auto-load history the first time a thread with no in-memory messages
    // is constructed with — mirrors useChat.ts's effect that fires on
    // threadId prop change when messages are still empty and not streaming;
    // there's no implicit "prop changed" signal for a plain class, so
    // setThreadId (below) re-runs this same check explicitly on later calls.
    if (threadId != null && state.messages.isEmpty) {
      unawaited(loadThreadMessages(threadId));
    }
  }

  final PersonaConfig _config;
  final Dio _dio;
  late final ChatStreamOpener _openChatStream;

  /// The agent this controller talks to by default — a per-call
  /// [SendMessageOverride.agentId] takes precedence, then this, then
  /// [PersonaConfig.defaultAgentId].
  String? agentId;
  String? _threadId;
  CancelToken? _cancelToken;

  final PersonaOnFinish? onFinish;
  final PersonaOnError? onError;
  final PersonaOnEvent? onEvent;

  /// Alias for `state.isStreaming`, kept for parity/discoverability with
  /// `useChat`'s returned object.
  bool get isLoading => state.isStreaming;

  String? get threadId => _threadId;

  void setInput(String value) => emit(state.copyWith(input: value));

  void setMessages(List<PersonaMessage> messages) => emit(state.copyWith(messages: messages));

  /// Dart-native replacement for the TS `useEffect` that re-ran on every
  /// `threadId` prop change: since a class API has no implicit "prop
  /// changed" signal, switching threads is this explicit call instead —
  /// re-running the same auto-load-if-empty-and-not-streaming check the
  /// constructor already runs once.
  void setThreadId(String? threadId) {
    _threadId = threadId;
    if (threadId != null && !state.isStreaming && state.messages.isEmpty) {
      unawaited(loadThreadMessages(threadId));
    }
  }

  /// GET `/threads/:id/messages` — the same message history + graph state
  /// [sendMessage] would resume from. Reconciles `subagentTraces` (keyed by
  /// `toolCallId`, in the folded/paired shape agent-backend persists) back
  /// onto the matching tool call's `subagentActivity`, so a reloaded
  /// subagent's activity renders identically to a live run.
  Future<List<PersonaMessage>> loadThreadMessages(String threadId) async {
    emit(state.copyWith(isLoadingHistory: true, error: null));
    try {
      final response = await _dio.get<Map<String, dynamic>>('/threads/$threadId/messages');
      final body = response.data ?? const {};
      final data = (body['data'] as Map<String, dynamic>?) ?? body;

      final rawMessages = (data['messages'] as List<dynamic>?) ?? const [];
      final subagentTraces = (data['subagentTraces'] as Map<String, dynamic>?) ?? const {};

      final loaded = <PersonaMessage>[];
      for (var i = 0; i < rawMessages.length; i++) {
        final raw = rawMessages[i] as Map<String, dynamic>;
        final rawToolCalls = raw['toolCalls'] as List<dynamic>?;
        final toolCalls = rawToolCalls
            ?.map((tc) {
              final toolCall = PersonaToolCall.fromJson(tc as Map<String, dynamic>);
              final trace = subagentTraces[toolCall.toolCallId];
              if (trace is List && trace.isNotEmpty) {
                return toolCall.copyWith(subagentActivity: persistedTraceToActivityEntries(trace));
              }
              return toolCall;
            })
            .toList();

        loaded.add(
          PersonaMessage(
            id: (raw['id'] as String?) ?? 'history-$threadId-$i',
            role: _roleFromWire(raw['role'] as String?),
            content: raw['content'] as String? ?? '',
            // Not present on the wire (checkpoint.service.js's
            // normalizeMessages emits no createdAt) — synthesized
            // client-side, matching useChat.ts's own `new Date()` here.
            createdAt: DateTime.now(),
            toolCalls: toolCalls,
          ),
        );
      }

      final rawState = (data['state'] as Map<String, dynamic>?) ?? const {};
      final rawFiles = (rawState['files'] as Map<String, dynamic>?) ?? const {};
      final rawTodos = (rawState['todos'] as List<dynamic>?) ?? const [];

      emit(
        state.copyWith(
          messages: loaded,
          isLoadingHistory: false,
          // Re-shows a paused approval/clarification card on reload if this
          // thread is currently paused — otherwise it wouldn't reappear
          // until the next live stream re-surfaces it.
          interrupt: normalizePendingInterrupt(data['pendingInterrupt']),
          files: normalizeWorkspaceFiles(rawFiles),
          todos: rawTodos.map((t) => PersonaTodo.fromJson(t as Map<String, dynamic>)).toList(),
        ),
      );
      return loaded;
    } catch (err) {
      emit(state.copyWith(isLoadingHistory: false, error: err));
      return const [];
    }
  }

  /// Sends [content] (or the current [PersonaChatState.input] if omitted).
  /// Builds an optimistic user message + an empty streaming-placeholder
  /// assistant message and appends both SYNCHRONOUSLY before any network
  /// call — this is why [SendMessageOverride.threadId] can be a
  /// `Future<String?>`: it's awaited lazily, right before the request body
  /// is built, so the optimistic UI never blocks on a still-in-flight
  /// thread creation.
  Future<void> sendMessage([String? content, SendMessageOverride? override]) async {
    final prompt = (content ?? state.input).trim();
    if (prompt.isEmpty || state.isStreaming) return;

    final targetAgentId = override?.agentId ?? agentId ?? _config.defaultAgentId;
    if (targetAgentId == null) {
      throw StateError(
        'PersonaChatController.sendMessage requires an agentId — pass one to '
        'the constructor, PersonaConfig.defaultAgentId, or this call\'s override.',
      );
    }

    final now = DateTime.now();
    final userMessage = PersonaMessage(
      id: 'user-${now.microsecondsSinceEpoch}',
      role: PersonaRole.user,
      content: prompt,
      createdAt: now,
    );
    final assistantId = 'assistant-${now.microsecondsSinceEpoch}';
    final placeholder = PersonaMessage(
      id: assistantId,
      role: PersonaRole.assistant,
      content: '',
      createdAt: now,
      isStreaming: true,
      toolCalls: const [],
    );

    final historyForRequest = [...state.messages, userMessage]
        .map((m) => {'role': m.role.name, 'content': m.content})
        .toList();

    emit(
      state.copyWith(
        messages: [...state.messages, userMessage, placeholder],
        input: '',
        isStreaming: true,
        error: null,
        interrupt: null,
      ),
    );

    final cancelToken = CancelToken();
    _cancelToken = cancelToken;

    try {
      final resolvedThreadId = await (override?.threadId ?? Future<String?>.value(_threadId));
      if (resolvedThreadId != null) _threadId = resolvedThreadId;

      final body = <String, dynamic>{
        'agentId': targetAgentId,
        'messages': historyForRequest,
        if (resolvedThreadId != null) 'threadId': resolvedThreadId,
        if (override?.resume != null) 'resume': override!.resume!.toJson(),
      };

      final byteStream = await _openChatStream(body, cancelToken);
      await _consumeStream(byteStream, assistantId, placeholder);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) {
        _settleCancelled(assistantId);
        return;
      }
      _handleSendError(assistantId, e);
    } catch (err) {
      _handleSendError(assistantId, err);
    } finally {
      if (identical(_cancelToken, cancelToken)) _cancelToken = null;
    }
  }

  Future<void> _consumeStream(
    Stream<List<int>> byteStream,
    String assistantId,
    PersonaMessage placeholder,
  ) async {
    var accumulatedText = '';
    var accumulatedReasoning = '';
    var isReasoning = false;
    final toolCallsMap = <String, PersonaToolCall>{};
    PersonaPresentedFile? presentedFile;
    PersonaInterrupt? interrupt;
    var files = state.files;
    var todos = state.todos;

    void patchAssistant() {
      final updated = state.messages
          .map(
            (m) => m.id != assistantId
                ? m
                : m.copyWith(
                    content: accumulatedText,
                    isStreaming: true,
                    toolCalls: toolCallsMap.values.toList(),
                    reasoning: accumulatedReasoning.isEmpty ? m.reasoning : accumulatedReasoning,
                    isReasoning: isReasoning,
                  ),
          )
          .toList();
      emit(
        state.copyWith(
          messages: updated,
          files: files,
          todos: todos,
          presentedFile: presentedFile ?? state.presentedFile,
          interrupt: interrupt ?? state.interrupt,
        ),
      );
    }

    await for (final event in parseChatEventStream(byteStream)) {
      onEvent?.call(event);

      switch (event) {
        case PersonaTextMessageChunkEvent(delta: final delta):
          accumulatedText += delta;
          patchAssistant();

        case PersonaToolCallChunkEvent(
          toolCallId: final id?,
          toolCallName: final name,
          delta: final delta,
        ):
          final existing = toolCallsMap[id];
          toolCallsMap[id] = existing == null
              ? PersonaToolCall(toolCallId: id, toolName: name ?? '', args: delta ?? '')
              : existing.copyWith(args: (existing.args ?? '') + (delta ?? ''));
          patchAssistant();

        case PersonaToolCallChunkEvent(toolCallId: null):
          break;

        case PersonaToolCallResultEvent(toolCallId: final id, content: final content):
          final existing = toolCallsMap[id];
          if (existing != null) {
            final isError = isErrorToolContent(content);
            toolCallsMap[id] = existing.copyWith(result: content, isError: isError);
            if (existing.toolName == 'present_file' && !isError) {
              final parsed = parsePresentedFile(content);
              if (parsed != null) presentedFile = parsed;
            }
          }
          patchAssistant();

        case PersonaStateSnapshotEvent(rawFiles: final rawFiles, rawTodos: final rawTodos):
          files = normalizeWorkspaceFiles(rawFiles);
          todos = rawTodos.map((t) => PersonaTodo.fromJson(t as Map<String, dynamic>)).toList();
          patchAssistant();

        case PersonaReasoningStartEvent():
          isReasoning = true;
          patchAssistant();

        case PersonaReasoningContentEvent(delta: final delta):
          isReasoning = true;
          accumulatedReasoning += delta;
          patchAssistant();

        case PersonaReasoningEndEvent():
          isReasoning = false;
          patchAssistant();

        case PersonaHitlRequestEvent(actionRequests: final actionRequests, reviewConfigs: final rc):
          interrupt = PersonaHitlInterrupt(actionRequests: actionRequests, reviewConfigs: rc);
          patchAssistant();

        case PersonaClarificationRequestEvent(questions: final questions):
          interrupt = PersonaClarificationInterrupt(questions: questions);
          patchAssistant();

        case PersonaSubagentActivityEvent(toolCallId: final id, entry: final entry):
          final existing = toolCallsMap[id];
          if (existing != null) {
            toolCallsMap[id] = existing.copyWith(
              subagentActivity: [...(existing.subagentActivity ?? const []), entry],
            );
            patchAssistant();
          }

        case PersonaRunErrorEvent(
          message: final message,
          code: final code,
          retryable: final retryable,
          providerName: final providerName,
        ):
          throw PersonaRunErrorException(
            message,
            code: code,
            retryable: retryable,
            providerName: providerName,
          );

        // No transcript handling — RUN_STARTED/RUN_FINISHED are lifecycle
        // markers only, mcp_app/unrecognized CUSTOM events reach consumers
        // via onEvent above and nothing else.
        case PersonaRunStartedEvent():
        case PersonaRunFinishedEvent():
        case PersonaMcpAppEvent():
        case PersonaGenericCustomEvent():
        case PersonaUnknownEvent():
          break;
      }
    }

    final finalMessage = placeholder.copyWith(
      content: accumulatedText,
      isStreaming: false,
      toolCalls: toolCallsMap.values.toList(),
      reasoning: accumulatedReasoning.isEmpty ? null : accumulatedReasoning,
      isReasoning: false,
    );
    final finalMessages = state.messages.map((m) => m.id == assistantId ? finalMessage : m).toList();
    emit(state.copyWith(messages: finalMessages, isStreaming: false));
    onFinish?.call(finalMessage);
  }

  void _settleCancelled(String assistantId) {
    final settled = state.messages
        .map((m) => m.id != assistantId ? m : m.copyWith(isStreaming: false))
        .toList();
    emit(state.copyWith(messages: settled, isStreaming: false));
  }

  void _handleSendError(String assistantId, Object err) {
    final message = err is PersonaRunErrorException ? err.message : err.toString();
    final patched = state.messages.map((m) {
      if (m.id != assistantId) return m;
      final content = m.content.isNotEmpty ? m.content : '⚠️ Error: $message';
      return m.copyWith(content: content, isStreaming: false);
    }).toList();
    emit(state.copyWith(messages: patched, isStreaming: false, error: err));
    onError?.call(err);
  }

  /// Cancels an in-progress reply, keeping whatever content has streamed so
  /// far. The in-flight `sendMessage` call's own `DioExceptionType.cancel`
  /// branch settles the placeholder's `isStreaming` flag; this also flips
  /// `state.isStreaming` immediately for instant UI feedback rather than
  /// waiting on that catch to run.
  void stop() {
    _cancelToken?.cancel();
    _cancelToken = null;
    emit(state.copyWith(isStreaming: false));
  }

  /// Truncates back to before the last user message and resends it.
  Future<void> reload() async {
    final messages = state.messages;
    final lastUserIndex = messages.lastIndexWhere((m) => m.role == PersonaRole.user);
    if (lastUserIndex == -1) return;
    final lastUserContent = messages[lastUserIndex].content;
    emit(state.copyWith(messages: messages.sublist(0, lastUserIndex)));
    await sendMessage(lastUserContent);
  }

  /// Sends [resume] to unpause a [PersonaChatState.interrupt] (HITL approval
  /// or clarification answers), with [displayContent] as the user-visible
  /// message text for this turn.
  Future<void> resumeInterrupt(PersonaResumeValue resume, String displayContent) {
    return sendMessage(displayContent, SendMessageOverride(resume: resume));
  }

  void dismissPresentedFile() => emit(state.copyWith(presentedFile: null));

  void openWorkspaceFile(String path) {
    final title = path.split('/').isEmpty ? path : path.split('/').last;
    emit(state.copyWith(presentedFile: PersonaPresentedFile(path: path, title: title, description: '')));
  }

  /// Stops any in-flight send and resets all state to empty.
  void clear() {
    stop();
    emit(const PersonaChatState());
  }

  @override
  void dispose() {
    _cancelToken?.cancel();
    super.dispose();
  }

  static PersonaRole _roleFromWire(String? value) => switch (value) {
    'user' => PersonaRole.user,
    'system' => PersonaRole.system,
    _ => PersonaRole.assistant,
  };
}
