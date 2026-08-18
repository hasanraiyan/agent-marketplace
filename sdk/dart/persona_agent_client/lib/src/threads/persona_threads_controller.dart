import 'package:dio/dio.dart';

import '../common/bulk_delete_result.dart';
import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import '../wire/wire_parsing.dart';
import 'persona_threads_state.dart';

/// Port of `useThreads` — thread list CRUD.
class PersonaThreadsController extends PersonaController<PersonaThreadsState> {
  PersonaThreadsController({required PersonaConfig config, bool autoFetch = true, Dio? dio})
    : _dio = dio ?? createPersonaHttpClient(config),
      super(const PersonaThreadsState()) {
    if (autoFetch) refetch();
  }

  final Dio _dio;

  Future<void> refetch() async {
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final response = await _dio.get<Object?>('/threads');
      final threads = extractListEnvelope(response.data)
          .map((e) => PersonaThread.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(state.copyWith(threads: threads, isLoading: false));
    } catch (err) {
      emit(state.copyWith(isLoading: false, error: err));
    }
  }

  Future<PersonaThread> createThread({required String agentId}) async {
    final response = await _dio.post<Object?>('/threads', data: {'agentId': agentId});
    final body = response.data;
    final data = body is Map<String, dynamic> && body.containsKey('data')
        ? body['data'] as Map<String, dynamic>
        : body as Map<String, dynamic>;
    final thread = PersonaThread.fromJson(data);
    emit(state.copyWith(threads: [thread, ...state.threads]));
    return thread;
  }

  Future<void> deleteThread(String id) async {
    await _dio.delete<void>('/threads/$id');
    emit(state.copyWith(threads: state.threads.where((t) => t.id != id).toList()));
  }

  /// `POST /threads/bulk-delete {ids}` — up to 100 ids per call.
  Future<PersonaBulkDeleteResult> bulkDeleteThreads(List<String> ids) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/threads/bulk-delete',
      data: {'ids': ids},
    );
    final result = PersonaBulkDeleteResult.fromJson(response.data ?? const {});
    final deletedIds = result.deleted.toSet();
    emit(state.copyWith(threads: state.threads.where((t) => !deletedIds.contains(t.id)).toList()));
    return result;
  }

  /// Client-side chunked loop over [bulkDeleteThreads] to delete every
  /// thread currently loaded, respecting the endpoint's 100-per-call limit.
  Future<void> deleteAllThreads() async {
    final ids = state.threads.map((t) => t.id).toList();
    for (var i = 0; i < ids.length; i += 100) {
      final chunk = ids.sublist(i, i + 100 > ids.length ? ids.length : i + 100);
      await bulkDeleteThreads(chunk);
    }
  }

  Future<PersonaThread> updateThread(String id, {String? title, bool? isArchived}) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/threads/$id',
      data: {if (title != null) 'title': title, if (isArchived != null) 'isArchived': isArchived},
    );
    final body = response.data ?? const {};
    final data = body.containsKey('data') ? body['data'] as Map<String, dynamic> : body;
    final thread = PersonaThread.fromJson(data);
    emit(state.copyWith(threads: state.threads.map((t) => t.id == id ? thread : t).toList()));
    return thread;
  }

  Future<PersonaThread> renameThread(String id, String title) => updateThread(id, title: title);

  Future<PersonaThread> getThread(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/threads/$id');
    final body = response.data ?? const {};
    final data = body.containsKey('data') ? body['data'] as Map<String, dynamic> : body;
    return PersonaThread.fromJson(data);
  }
}
