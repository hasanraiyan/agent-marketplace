// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_memory.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaMemoryFile _$PersonaMemoryFileFromJson(Map<String, dynamic> json) =>
    _PersonaMemoryFile(
      scope: $enumDecodeNullable(_$PersonaMemoryScopeEnumMap, json['scope']),
      agentId: json['agentId'] as String?,
      path: json['path'] as String,
      content: json['content'] as String,
      mimeType: json['mimeType'] as String?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );

Map<String, dynamic> _$PersonaMemoryFileToJson(_PersonaMemoryFile instance) =>
    <String, dynamic>{
      'scope': _$PersonaMemoryScopeEnumMap[instance.scope],
      'agentId': instance.agentId,
      'path': instance.path,
      'content': instance.content,
      'mimeType': instance.mimeType,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
    };

const _$PersonaMemoryScopeEnumMap = {
  PersonaMemoryScope.user: 'user',
  PersonaMemoryScope.agent: 'agent',
};

_PersonaMemoryAgentGroup _$PersonaMemoryAgentGroupFromJson(
  Map<String, dynamic> json,
) => _PersonaMemoryAgentGroup(
  agentId: json['agentId'] as String,
  agentName: json['agentName'] as String?,
  files: (json['files'] as List<dynamic>)
      .map((e) => PersonaMemoryFile.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$PersonaMemoryAgentGroupToJson(
  _PersonaMemoryAgentGroup instance,
) => <String, dynamic>{
  'agentId': instance.agentId,
  'agentName': instance.agentName,
  'files': instance.files,
};

_PersonaMemoryList _$PersonaMemoryListFromJson(Map<String, dynamic> json) =>
    _PersonaMemoryList(
      userFiles: (json['userFiles'] as List<dynamic>)
          .map((e) => PersonaMemoryFile.fromJson(e as Map<String, dynamic>))
          .toList(),
      agentMemories: (json['agentMemories'] as List<dynamic>)
          .map(
            (e) => PersonaMemoryAgentGroup.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );

Map<String, dynamic> _$PersonaMemoryListToJson(_PersonaMemoryList instance) =>
    <String, dynamic>{
      'userFiles': instance.userFiles,
      'agentMemories': instance.agentMemories,
    };
