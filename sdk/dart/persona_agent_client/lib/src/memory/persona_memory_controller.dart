import 'package:dio/dio.dart';

import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import 'persona_memory_state.dart';

/// Port of `useMemory` — the agent's long-term memory files (user-scoped
/// and per-agent).
class PersonaMemoryController extends PersonaController<PersonaMemoryState> {
  PersonaMemoryController({required PersonaConfig config, bool autoFetch = true, Dio? dio})
    : _dio = dio ?? createPersonaHttpClient(config),
      super(const PersonaMemoryState()) {
    if (autoFetch) refetch();
  }

  final Dio _dio;

  Future<void> refetch() async {
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final response = await _dio.get<Map<String, dynamic>>('/memory');
      final body = response.data ?? const {};
      final data = body.containsKey('data') ? body['data'] as Map<String, dynamic> : body;
      emit(state.copyWith(memory: PersonaMemoryList.fromJson(data), isLoading: false));
    } catch (err) {
      emit(state.copyWith(isLoading: false, error: err));
    }
  }

  Future<PersonaMemoryFile> getFile({
    required String path,
    PersonaMemoryScope? scope,
    String? agentId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/memory/file',
      queryParameters: {
        'path': path,
        if (scope != null) 'scope': scope.name,
        if (agentId != null) 'agentId': agentId,
      },
    );
    final body = response.data ?? const {};
    final data = body.containsKey('data') ? body['data'] as Map<String, dynamic> : body;
    return PersonaMemoryFile.fromJson(data);
  }

  Future<void> writeFile({
    required String path,
    required String content,
    PersonaMemoryScope? scope,
    String? agentId,
  }) async {
    await _dio.put<void>(
      '/memory/file',
      data: {
        'path': path,
        'content': content,
        if (scope != null) 'scope': scope.name,
        if (agentId != null) 'agentId': agentId,
      },
    );
    await refetch();
  }

  Future<void> deleteFile({required String path, PersonaMemoryScope? scope, String? agentId}) async {
    await _dio.delete<void>(
      '/memory/file',
      queryParameters: {
        'path': path,
        if (scope != null) 'scope': scope.name,
        if (agentId != null) 'agentId': agentId,
      },
    );
    await refetch();
  }
}
