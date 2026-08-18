import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_chat_state.freezed.dart';

@freezed
abstract class PersonaChatState with _$PersonaChatState {
  const factory PersonaChatState({
    @Default([]) List<PersonaMessage> messages,
    @Default('') String input,
    @Default(false) bool isStreaming,
    @Default(false) bool isLoadingHistory,
    Object? error,
    PersonaInterrupt? interrupt,
    @Default({}) Map<String, PersonaWorkspaceFile> files,
    @Default([]) List<PersonaTodo> todos,
    PersonaPresentedFile? presentedFile,
  }) = _PersonaChatState;

  const PersonaChatState._();

  /// Alias for [isStreaming], kept for parity/discoverability with
  /// `useChat`'s returned object, which exposes both names.
  bool get isLoading => isStreaming;
}
