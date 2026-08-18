// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_file_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaFileItem _$PersonaFileItemFromJson(Map<String, dynamic> json) =>
    _PersonaFileItem(
      id: json['id'] as String,
      originalName: json['originalName'] as String,
      mimeType: json['mimeType'] as String,
      size: (json['size'] as num).toInt(),
      agentId: json['agentId'] as String?,
      threadId: json['threadId'] as String?,
      createdAt: json['createdAt'] as String,
    );

Map<String, dynamic> _$PersonaFileItemToJson(_PersonaFileItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'originalName': instance.originalName,
      'mimeType': instance.mimeType,
      'size': instance.size,
      'agentId': instance.agentId,
      'threadId': instance.threadId,
      'createdAt': instance.createdAt,
    };
