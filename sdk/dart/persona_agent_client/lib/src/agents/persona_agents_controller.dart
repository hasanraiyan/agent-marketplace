import 'package:dio/dio.dart';

import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import '../wire/wire_parsing.dart';
import 'persona_agents_state.dart';

/// Port of `useAgents` — the list of agents this credential can see.
class PersonaAgentsController extends PersonaController<PersonaAgentsState> {
  PersonaAgentsController({required PersonaConfig config, bool autoFetch = true, Dio? dio})
    : _dio = dio ?? createPersonaHttpClient(config),
      super(const PersonaAgentsState()) {
    if (autoFetch) refetch();
  }

  final Dio _dio;

  Future<void> refetch() async {
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final response = await _dio.get<Object?>('/agents');
      final agents = extractListEnvelope(response.data)
          .map((e) => PersonaAgentSummary.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(state.copyWith(agents: agents, isLoading: false));
    } catch (err) {
      emit(state.copyWith(isLoading: false, error: err));
    }
  }
}
