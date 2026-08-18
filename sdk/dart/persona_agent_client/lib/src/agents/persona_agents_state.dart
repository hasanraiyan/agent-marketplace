import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_agents_state.freezed.dart';

@freezed
abstract class PersonaAgentsState with _$PersonaAgentsState {
  const factory PersonaAgentsState({
    @Default([]) List<PersonaAgentSummary> agents,
    @Default(false) bool isLoading,
    Object? error,
  }) = _PersonaAgentsState;
}
