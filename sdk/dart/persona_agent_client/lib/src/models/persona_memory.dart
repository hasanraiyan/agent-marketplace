import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_memory.freezed.dart';
part 'persona_memory.g.dart';

enum PersonaMemoryScope { user, agent }

@freezed
abstract class PersonaMemoryFile with _$PersonaMemoryFile {
  const factory PersonaMemoryFile({
    PersonaMemoryScope? scope,
    String? agentId,
    required String path,
    required String content,
    String? mimeType,
    String? createdAt,
    String? updatedAt,
  }) = _PersonaMemoryFile;

  factory PersonaMemoryFile.fromJson(Map<String, dynamic> json) => _$PersonaMemoryFileFromJson(json);
}

@freezed
abstract class PersonaMemoryAgentGroup with _$PersonaMemoryAgentGroup {
  const factory PersonaMemoryAgentGroup({
    required String agentId,
    String? agentName,
    required List<PersonaMemoryFile> files,
  }) = _PersonaMemoryAgentGroup;

  factory PersonaMemoryAgentGroup.fromJson(Map<String, dynamic> json) =>
      _$PersonaMemoryAgentGroupFromJson(json);
}

@freezed
abstract class PersonaMemoryList with _$PersonaMemoryList {
  const factory PersonaMemoryList({
    required List<PersonaMemoryFile> userFiles,
    required List<PersonaMemoryAgentGroup> agentMemories,
  }) = _PersonaMemoryList;

  factory PersonaMemoryList.fromJson(Map<String, dynamic> json) => _$PersonaMemoryListFromJson(json);
}
