import 'package:dio/dio.dart';

import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import 'persona_connection_state.dart';

/// Port of `useConnection` — a lightweight backend reachability/health
/// check.
class PersonaConnectionController extends PersonaController<PersonaConnectionState> {
  PersonaConnectionController({required PersonaConfig config, bool autoCheck = true, Dio? dio})
    : _dio = dio ?? createPersonaHttpClient(config),
      super(const PersonaConnectionState()) {
    if (autoCheck) checkHealth();
  }

  final Dio _dio;

  Future<void> checkHealth() async {
    emit(state.copyWith(isLoading: true));
    try {
      final response = await _dio.get<Map<String, dynamic>>('/health');
      final body = response.data ?? const {};
      final data = body.containsKey('data') ? body['data'] as Map<String, dynamic> : body;
      emit(
        PersonaConnectionState(isConnected: true, health: PersonaHealthInfo.fromJson(data), isLoading: false),
      );
    } catch (_) {
      emit(const PersonaConnectionState(isConnected: false, isLoading: false));
    }
  }
}
