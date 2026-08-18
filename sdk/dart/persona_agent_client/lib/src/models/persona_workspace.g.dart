// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_workspace.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaWorkspaceFile _$PersonaWorkspaceFileFromJson(
  Map<String, dynamic> json,
) => _PersonaWorkspaceFile(
  content: json['content'] as String,
  size: (json['size'] as num).toInt(),
  createdAt: json['createdAt'] as String?,
  modifiedAt: json['modifiedAt'] as String?,
);

Map<String, dynamic> _$PersonaWorkspaceFileToJson(
  _PersonaWorkspaceFile instance,
) => <String, dynamic>{
  'content': instance.content,
  'size': instance.size,
  'createdAt': instance.createdAt,
  'modifiedAt': instance.modifiedAt,
};

_PersonaTodo _$PersonaTodoFromJson(Map<String, dynamic> json) => _PersonaTodo(
  content: json['content'] as String,
  status: json['status'] as String,
);

Map<String, dynamic> _$PersonaTodoToJson(_PersonaTodo instance) =>
    <String, dynamic>{'content': instance.content, 'status': instance.status};

_PersonaPresentedFile _$PersonaPresentedFileFromJson(
  Map<String, dynamic> json,
) => _PersonaPresentedFile(
  path: json['path'] as String,
  title: json['title'] as String,
  description: json['description'] as String,
);

Map<String, dynamic> _$PersonaPresentedFileToJson(
  _PersonaPresentedFile instance,
) => <String, dynamic>{
  'path': instance.path,
  'title': instance.title,
  'description': instance.description,
};
