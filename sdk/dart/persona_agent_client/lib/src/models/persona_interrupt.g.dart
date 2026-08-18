// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_interrupt.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaHitlActionRequest _$PersonaHitlActionRequestFromJson(
  Map<String, dynamic> json,
) =>
    _PersonaHitlActionRequest(name: json['name'] as String, args: json['args']);

Map<String, dynamic> _$PersonaHitlActionRequestToJson(
  _PersonaHitlActionRequest instance,
) => <String, dynamic>{'name': instance.name, 'args': instance.args};

_PersonaClarificationQuestion _$PersonaClarificationQuestionFromJson(
  Map<String, dynamic> json,
) => _PersonaClarificationQuestion(
  id: json['id'] as String,
  text: json['text'] as String,
  options: (json['options'] as List<dynamic>).map((e) => e as String).toList(),
  required: json['required'] as bool,
  allowCustom: json['allowCustom'] as bool,
);

Map<String, dynamic> _$PersonaClarificationQuestionToJson(
  _PersonaClarificationQuestion instance,
) => <String, dynamic>{
  'id': instance.id,
  'text': instance.text,
  'options': instance.options,
  'required': instance.required,
  'allowCustom': instance.allowCustom,
};
