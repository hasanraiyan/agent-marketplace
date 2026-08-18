// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_tool_call.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaSubagentActivityEntry _$PersonaSubagentActivityEntryFromJson(
  Map<String, dynamic> json,
) => _PersonaSubagentActivityEntry(
  kind: $enumDecode(_$PersonaSubagentActivityKindEnumMap, json['kind']),
  toolName: json['toolName'] as String?,
  args: json['args'] as String?,
  result: json['result'] as String?,
  delta: json['delta'] as String?,
);

Map<String, dynamic> _$PersonaSubagentActivityEntryToJson(
  _PersonaSubagentActivityEntry instance,
) => <String, dynamic>{
  'kind': _$PersonaSubagentActivityKindEnumMap[instance.kind]!,
  'toolName': instance.toolName,
  'args': instance.args,
  'result': instance.result,
  'delta': instance.delta,
};

const _$PersonaSubagentActivityKindEnumMap = {
  PersonaSubagentActivityKind.text: 'text',
  PersonaSubagentActivityKind.toolStart: 'tool_start',
  PersonaSubagentActivityKind.toolResult: 'tool_result',
};

_PersonaToolCall _$PersonaToolCallFromJson(Map<String, dynamic> json) =>
    _PersonaToolCall(
      toolCallId: json['toolCallId'] as String,
      toolName: json['toolName'] as String,
      args: json['args'] as String?,
      result: json['result'] as String?,
      isError: json['isError'] as bool? ?? false,
      subagentActivity: (json['subagentActivity'] as List<dynamic>?)
          ?.map(
            (e) => PersonaSubagentActivityEntry.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    );

Map<String, dynamic> _$PersonaToolCallToJson(_PersonaToolCall instance) =>
    <String, dynamic>{
      'toolCallId': instance.toolCallId,
      'toolName': instance.toolName,
      'args': instance.args,
      'result': instance.result,
      'isError': instance.isError,
      'subagentActivity': instance.subagentActivity,
    };
