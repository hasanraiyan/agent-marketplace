import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_files_state.freezed.dart';

@freezed
abstract class PersonaFilesState with _$PersonaFilesState {
  const factory PersonaFilesState({
    @Default([]) List<PersonaFileItem> files,
    @Default(false) bool isLoading,
    @Default(false) bool isUploading,
    Object? error,
  }) = _PersonaFilesState;
}
