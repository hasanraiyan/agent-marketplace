import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_memory_state.freezed.dart';

@freezed
abstract class PersonaMemoryState with _$PersonaMemoryState {
  const factory PersonaMemoryState({PersonaMemoryList? memory, @Default(false) bool isLoading, Object? error}) =
      _PersonaMemoryState;
}
