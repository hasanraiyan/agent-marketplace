import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_connection_state.freezed.dart';

@freezed
abstract class PersonaConnectionState with _$PersonaConnectionState {
  const factory PersonaConnectionState({
    @Default(false) bool isConnected,
    PersonaHealthInfo? health,
    @Default(false) bool isLoading,
  }) = _PersonaConnectionState;
}
