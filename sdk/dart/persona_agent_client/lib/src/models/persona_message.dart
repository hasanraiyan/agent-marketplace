import 'package:freezed_annotation/freezed_annotation.dart';

import 'persona_role.dart';
import 'persona_tool_call.dart';

part 'persona_message.freezed.dart';
part 'persona_message.g.dart';

@freezed
abstract class PersonaMessage with _$PersonaMessage {
  const factory PersonaMessage({
    required String id,
    required PersonaRole role,
    required String content,
    required DateTime createdAt,
    @Default(false) bool isStreaming,
    List<PersonaToolCall>? toolCalls,
    /// Model reasoning/thinking text streamed ahead of the final answer,
    /// when the provider exposes it.
    String? reasoning,
    @Default(false) bool isReasoning,
  }) = _PersonaMessage;

  factory PersonaMessage.fromJson(Map<String, dynamic> json) => _$PersonaMessageFromJson(json);
}
