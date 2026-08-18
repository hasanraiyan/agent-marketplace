import 'persona_interrupt.dart';
import 'persona_tool_call.dart';

/// One decoded line from the AG-UI SSE stream (`data: {...}\n`). Write-once/
/// read-once — built from a decoded JSON line, pattern-matched immediately
/// by [PersonaChatController], then discarded — so this is a plain sealed
/// class, not a freezed union: nothing here ever needs `copyWith`.
///
/// This backend only emits a subset of the full AG-UI protocol (chunked
/// tool-call args via `TOOL_CALL_CHUNK` rather than separate START/ARGS
/// events, no `TEXT_MESSAGE_START`/`TEXT_MESSAGE_END`) — mirrors
/// `sdk/react/src/types.ts`'s `PersonaStreamingEvent` exactly, which is the
/// authoritative wire contract, not the older event vocabulary the
/// standalone `persona` Flutter app's own hand-rolled client still expects.
sealed class PersonaStreamingEvent {
  const PersonaStreamingEvent();

  factory PersonaStreamingEvent.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    return switch (type) {
      'TEXT_MESSAGE_CHUNK' => PersonaTextMessageChunkEvent._fromJson(json),
      'TOOL_CALL_CHUNK' => PersonaToolCallChunkEvent._fromJson(json),
      'TOOL_CALL_RESULT' => PersonaToolCallResultEvent._fromJson(json),
      'REASONING_MESSAGE_START' => PersonaReasoningStartEvent._fromJson(json),
      'REASONING_MESSAGE_CONTENT' => PersonaReasoningContentEvent._fromJson(json),
      'REASONING_END' => const PersonaReasoningEndEvent(),
      'STATE_SNAPSHOT' => PersonaStateSnapshotEvent._fromJson(json),
      'RUN_ERROR' => PersonaRunErrorEvent._fromJson(json),
      'RUN_STARTED' => PersonaRunStartedEvent._fromJson(json),
      'RUN_FINISHED' => PersonaRunFinishedEvent._fromJson(json),
      'CUSTOM' => PersonaCustomEvent._fromJson(json),
      _ => PersonaUnknownEvent(type ?? '', json),
    };
  }
}

final class PersonaTextMessageChunkEvent extends PersonaStreamingEvent {
  const PersonaTextMessageChunkEvent({required this.delta, this.messageId, this.role});

  final String delta;
  final String? messageId;
  final String? role;

  factory PersonaTextMessageChunkEvent._fromJson(Map<String, dynamic> json) =>
      PersonaTextMessageChunkEvent(
        delta: json['delta'] as String? ?? '',
        messageId: json['messageId'] as String?,
        role: json['role'] as String?,
      );
}

final class PersonaToolCallChunkEvent extends PersonaStreamingEvent {
  const PersonaToolCallChunkEvent({
    this.toolCallId,
    this.toolCallName,
    this.delta,
    this.parentMessageId,
  });

  final String? toolCallId;
  final String? toolCallName;
  final String? delta;
  final String? parentMessageId;

  factory PersonaToolCallChunkEvent._fromJson(Map<String, dynamic> json) => PersonaToolCallChunkEvent(
    toolCallId: json['toolCallId'] as String?,
    toolCallName: json['toolCallName'] as String?,
    delta: json['delta'] as String?,
    parentMessageId: json['parentMessageId'] as String?,
  );
}

final class PersonaToolCallResultEvent extends PersonaStreamingEvent {
  const PersonaToolCallResultEvent({
    required this.toolCallId,
    required this.content,
    this.messageId,
    this.role,
    this.structuredContent,
  });

  final String toolCallId;
  final String content;
  final String? messageId;
  final String? role;
  final Object? structuredContent;

  factory PersonaToolCallResultEvent._fromJson(Map<String, dynamic> json) => PersonaToolCallResultEvent(
    toolCallId: json['toolCallId'] as String? ?? '',
    content: json['content'] as String? ?? '',
    messageId: json['messageId'] as String?,
    role: json['role'] as String?,
    structuredContent: json['structuredContent'],
  );
}

final class PersonaReasoningStartEvent extends PersonaStreamingEvent {
  const PersonaReasoningStartEvent({required this.messageId});

  final String messageId;

  factory PersonaReasoningStartEvent._fromJson(Map<String, dynamic> json) =>
      PersonaReasoningStartEvent(messageId: json['messageId'] as String? ?? '');
}

final class PersonaReasoningContentEvent extends PersonaStreamingEvent {
  const PersonaReasoningContentEvent({required this.messageId, required this.delta});

  final String messageId;
  final String delta;

  factory PersonaReasoningContentEvent._fromJson(Map<String, dynamic> json) =>
      PersonaReasoningContentEvent(
        messageId: json['messageId'] as String? ?? '',
        delta: json['delta'] as String? ?? '',
      );
}

final class PersonaReasoningEndEvent extends PersonaStreamingEvent {
  const PersonaReasoningEndEvent();
}

/// Raw wire shape (`snapshot.files` keyed by path, snake_case
/// `created_at`/`modified_at`) — deliberately NOT normalized here.
/// [PersonaChatController] normalizes into [PersonaWorkspaceFile] via
/// `wire/wire_parsing.dart`'s `normalizeWorkspaceFiles`, matching the TS
/// source's own split between the raw wire event and its `useChat.ts`
/// consumer.
final class PersonaStateSnapshotEvent extends PersonaStreamingEvent {
  const PersonaStateSnapshotEvent({required this.rawFiles, required this.rawTodos});

  final Map<String, dynamic> rawFiles;
  final List<dynamic> rawTodos;

  factory PersonaStateSnapshotEvent._fromJson(Map<String, dynamic> json) {
    final snapshot = json['snapshot'] as Map<String, dynamic>? ?? const {};
    return PersonaStateSnapshotEvent(
      rawFiles: (snapshot['files'] as Map<String, dynamic>?) ?? const {},
      rawTodos: (snapshot['todos'] as List<dynamic>?) ?? const [],
    );
  }
}

final class PersonaRunErrorEvent extends PersonaStreamingEvent {
  const PersonaRunErrorEvent({
    required this.code,
    required this.message,
    this.retryable,
    this.providerName,
  });

  final String? code;
  final String message;
  final bool? retryable;
  final String? providerName;

  factory PersonaRunErrorEvent._fromJson(Map<String, dynamic> json) => PersonaRunErrorEvent(
    code: json['code'] as String?,
    message: json['message'] as String? ?? 'Stream error from agent',
    retryable: json['retryable'] as bool?,
    providerName: json['providerName'] as String?,
  );
}

final class PersonaRunStartedEvent extends PersonaStreamingEvent {
  const PersonaRunStartedEvent({required this.threadId, required this.runId});

  final String threadId;
  final String runId;

  factory PersonaRunStartedEvent._fromJson(Map<String, dynamic> json) => PersonaRunStartedEvent(
    threadId: json['threadId'] as String? ?? '',
    runId: json['runId'] as String? ?? '',
  );
}

final class PersonaRunFinishedEvent extends PersonaStreamingEvent {
  const PersonaRunFinishedEvent({required this.threadId, required this.runId});

  final String threadId;
  final String runId;

  factory PersonaRunFinishedEvent._fromJson(Map<String, dynamic> json) => PersonaRunFinishedEvent(
    threadId: json['threadId'] as String? ?? '',
    runId: json['runId'] as String? ?? '',
  );
}

/// A `CUSTOM` AG-UI event, further discriminated by `name`. Backend-known
/// names each get their own final class; anything else falls back to
/// [PersonaGenericCustomEvent] so a consumer can still read it via `onEvent`
/// without this client needing to know every possible custom event ahead of
/// time (e.g. a future MCP-app-specific event this client hasn't been
/// updated for yet).
sealed class PersonaCustomEvent extends PersonaStreamingEvent {
  const PersonaCustomEvent();

  factory PersonaCustomEvent._fromJson(Map<String, dynamic> json) {
    final name = json['name'] as String? ?? '';
    final value = (json['value'] as Map<String, dynamic>?) ?? const {};
    return switch (name) {
      'hitl_request' => PersonaHitlRequestEvent._fromValue(value),
      'clarification_request' => PersonaClarificationRequestEvent._fromValue(value),
      'subagent_activity' => PersonaSubagentActivityEvent._fromValue(value),
      'mcp_app' => PersonaMcpAppEvent._fromValue(value),
      _ => PersonaGenericCustomEvent(name, value),
    };
  }
}

final class PersonaHitlRequestEvent extends PersonaCustomEvent {
  const PersonaHitlRequestEvent({required this.actionRequests, required this.reviewConfigs});

  final List<PersonaHitlActionRequest> actionRequests;
  final List<Object?> reviewConfigs;

  factory PersonaHitlRequestEvent._fromValue(Map<String, dynamic> value) => PersonaHitlRequestEvent(
    actionRequests: (value['actionRequests'] as List<dynamic>? ?? [])
        .map((e) => PersonaHitlActionRequest.fromJson(e as Map<String, dynamic>))
        .toList(),
    reviewConfigs: (value['reviewConfigs'] as List<dynamic>?) ?? const [],
  );
}

final class PersonaClarificationRequestEvent extends PersonaCustomEvent {
  const PersonaClarificationRequestEvent({required this.questions});

  final List<PersonaClarificationQuestion> questions;

  factory PersonaClarificationRequestEvent._fromValue(Map<String, dynamic> value) =>
      PersonaClarificationRequestEvent(
        questions: (value['questions'] as List<dynamic>? ?? [])
            .map((e) => PersonaClarificationQuestion.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

final class PersonaSubagentActivityEvent extends PersonaCustomEvent {
  const PersonaSubagentActivityEvent({required this.toolCallId, required this.entry});

  final String toolCallId;
  final PersonaSubagentActivityEntry entry;

  factory PersonaSubagentActivityEvent._fromValue(Map<String, dynamic> value) =>
      PersonaSubagentActivityEvent(
        toolCallId: value['toolCallId'] as String? ?? '',
        entry: PersonaSubagentActivityEntry.fromJson(value),
      );
}

final class PersonaMcpAppEvent extends PersonaCustomEvent {
  const PersonaMcpAppEvent({required this.toolCallId, required this.resourceUri, required this.mcpId});

  final String toolCallId;
  final String resourceUri;
  final String mcpId;

  factory PersonaMcpAppEvent._fromValue(Map<String, dynamic> value) => PersonaMcpAppEvent(
    toolCallId: value['toolCallId'] as String? ?? '',
    resourceUri: value['resourceUri'] as String? ?? '',
    mcpId: value['mcpId'] as String? ?? '',
  );
}

final class PersonaGenericCustomEvent extends PersonaCustomEvent {
  const PersonaGenericCustomEvent(this.name, this.value);

  final String name;
  final Object? value;
}

/// A `type` this client doesn't recognize — forward-compatible fallback so a
/// backend protocol addition doesn't crash the SSE parse loop; still
/// reachable via `onEvent` for a consumer that wants to handle it anyway.
final class PersonaUnknownEvent extends PersonaStreamingEvent {
  const PersonaUnknownEvent(this.type, this.raw);

  final String type;
  final Map<String, dynamic> raw;
}
