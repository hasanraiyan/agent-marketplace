import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_threads_state.freezed.dart';

@freezed
abstract class PersonaThreadsState with _$PersonaThreadsState {
  const factory PersonaThreadsState({
    @Default([]) List<PersonaThread> threads,
    @Default(false) bool isLoading,
    Object? error,
  }) = _PersonaThreadsState;
}
