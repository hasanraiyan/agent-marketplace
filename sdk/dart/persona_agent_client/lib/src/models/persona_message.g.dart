// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaMessage _$PersonaMessageFromJson(Map<String, dynamic> json) =>
    _PersonaMessage(
      id: json['id'] as String,
      role: $enumDecode(_$PersonaRoleEnumMap, json['role']),
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isStreaming: json['isStreaming'] as bool? ?? false,
      toolCalls: (json['toolCalls'] as List<dynamic>?)
          ?.map((e) => PersonaToolCall.fromJson(e as Map<String, dynamic>))
          .toList(),
      reasoning: json['reasoning'] as String?,
      isReasoning: json['isReasoning'] as bool? ?? false,
    );

Map<String, dynamic> _$PersonaMessageToJson(_PersonaMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'role': _$PersonaRoleEnumMap[instance.role]!,
      'content': instance.content,
      'createdAt': instance.createdAt.toIso8601String(),
      'isStreaming': instance.isStreaming,
      'toolCalls': instance.toolCalls,
      'reasoning': instance.reasoning,
      'isReasoning': instance.isReasoning,
    };

const _$PersonaRoleEnumMap = {
  PersonaRole.user: 'user',
  PersonaRole.assistant: 'assistant',
  PersonaRole.system: 'system',
};
