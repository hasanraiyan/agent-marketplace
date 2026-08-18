import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_tool_call.freezed.dart';
part 'persona_tool_call.g.dart';

/// One event in a subagent's (`task` tool) own activity timeline — either a
/// streamed text delta from its internal model, or the start/result of one
/// of its own nested tool calls. Mirrors the live AG-UI `subagent_activity`
/// CUSTOM event shape (`kind`-discriminated), not the folded/paired shape
/// agent-backend persists for reload (that reconciliation is the server's
/// job — the wire shape this client reads from `GET /threads/:id/messages`'s
/// `subagentTraces` field is already re-expanded into this same shape by the
/// backend before it reaches any client).
enum PersonaSubagentActivityKind {
  @JsonValue('text')
  text,
  @JsonValue('tool_start')
  toolStart,
  @JsonValue('tool_result')
  toolResult,
}

@freezed
abstract class PersonaSubagentActivityEntry with _$PersonaSubagentActivityEntry {
  const factory PersonaSubagentActivityEntry({
    required PersonaSubagentActivityKind kind,
    String? toolName,
    String? args,
    String? result,
    String? delta,
  }) = _PersonaSubagentActivityEntry;

  factory PersonaSubagentActivityEntry.fromJson(Map<String, dynamic> json) =>
      _$PersonaSubagentActivityEntryFromJson(json);
}

@freezed
abstract class PersonaToolCall with _$PersonaToolCall {
  const factory PersonaToolCall({
    required String toolCallId,
    required String toolName,
    String? args,
    String? result,
    @Default(false) bool isError,
    /// Nested activity timeline — only present on `task` (subagent) tool calls.
    List<PersonaSubagentActivityEntry>? subagentActivity,
  }) = _PersonaToolCall;

  factory PersonaToolCall.fromJson(Map<String, dynamic> json) => _$PersonaToolCallFromJson(json);
}
