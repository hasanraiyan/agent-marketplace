import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_workspace.freezed.dart';
part 'persona_workspace.g.dart';

/// One file in the agent's virtual workspace. `createdAt`/`modifiedAt` stay
/// raw ISO strings (not parsed to [DateTime]) — matches the TS source, which
/// leaves them as strings too, since nothing on the client actually needs to
/// do date arithmetic on them.
@freezed
abstract class PersonaWorkspaceFile with _$PersonaWorkspaceFile {
  const factory PersonaWorkspaceFile({
    required String content,
    required int size,
    String? createdAt,
    String? modifiedAt,
  }) = _PersonaWorkspaceFile;

  factory PersonaWorkspaceFile.fromJson(Map<String, dynamic> json) =>
      _$PersonaWorkspaceFileFromJson(json);
}

@freezed
abstract class PersonaTodo with _$PersonaTodo {
  const factory PersonaTodo({required String content, required String status}) = _PersonaTodo;

  factory PersonaTodo.fromJson(Map<String, dynamic> json) => _$PersonaTodoFromJson(json);
}

/// Set when the agent calls `present_file` — a signal to highlight this path
/// in the workspace files panel.
@freezed
abstract class PersonaPresentedFile with _$PersonaPresentedFile {
  const factory PersonaPresentedFile({
    required String path,
    required String title,
    required String description,
  }) = _PersonaPresentedFile;

  factory PersonaPresentedFile.fromJson(Map<String, dynamic> json) =>
      _$PersonaPresentedFileFromJson(json);
}
