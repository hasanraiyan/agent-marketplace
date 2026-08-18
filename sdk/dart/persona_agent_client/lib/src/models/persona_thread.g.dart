// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_thread.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaThread _$PersonaThreadFromJson(Map<String, dynamic> json) =>
    _PersonaThread(
      id: json['_id'] as String,
      agentId: PersonaAgentRef.fromJson(json['agentId']),
      title: json['title'] as String?,
      isArchived: json['isArchived'] as bool?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );

Map<String, dynamic> _$PersonaThreadToJson(_PersonaThread instance) =>
    <String, dynamic>{
      '_id': instance.id,
      'agentId': _agentRefToJson(instance.agentId),
      'title': instance.title,
      'isArchived': instance.isArchived,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
    };
