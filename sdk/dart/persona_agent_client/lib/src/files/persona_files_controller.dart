import 'package:dio/dio.dart';

import '../common/bulk_delete_result.dart';
import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import '../wire/wire_parsing.dart';
import 'persona_files_state.dart';

/// Port of `useFiles` — uploaded file CRUD. Takes raw bytes + a filename
/// rather than a platform file path (unlike a Node/browser `File` object,
/// Dart/Flutter has no single cross-platform file handle — a caller on
/// mobile typically already has bytes via `file_picker`'s
/// `PlatformFile.bytes`, and this keeps the package usable on web too).
class PersonaFilesController extends PersonaController<PersonaFilesState> {
  PersonaFilesController({required PersonaConfig config, bool autoFetch = true, Dio? dio})
    : _config = config,
      _dio = dio ?? createPersonaHttpClient(config),
      super(const PersonaFilesState()) {
    if (autoFetch) refetch();
  }

  final PersonaConfig _config;
  final Dio _dio;

  Future<void> refetch() async {
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final response = await _dio.get<Object?>('/files');
      final files = extractListEnvelope(response.data)
          .map((e) => PersonaFileItem.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(state.copyWith(files: files, isLoading: false));
    } catch (err) {
      emit(state.copyWith(isLoading: false, error: err));
    }
  }

  Future<PersonaFileItem> uploadFile({
    required List<int> bytes,
    required String filename,
    String? mimeType,
    String? agentId,
    String? threadId,
  }) async {
    emit(state.copyWith(isUploading: true));
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename, contentType: _mediaType(mimeType)),
        if (agentId != null) 'agentId': agentId,
        if (threadId != null) 'threadId': threadId,
      });
      final response = await _dio.post<Object?>('/files', data: formData);
      final body = response.data;
      final data = body is Map<String, dynamic> && body.containsKey('data')
          ? body['data'] as Map<String, dynamic>
          : body as Map<String, dynamic>;
      final file = PersonaFileItem.fromJson(data);
      emit(state.copyWith(files: [file, ...state.files], isUploading: false));
      return file;
    } catch (err) {
      emit(state.copyWith(isUploading: false, error: err));
      rethrow;
    }
  }

  Future<void> deleteFile(String id) async {
    await _dio.delete<void>('/files/$id');
    emit(state.copyWith(files: state.files.where((f) => f.id != id).toList()));
  }

  Future<PersonaBulkDeleteResult> bulkDeleteFiles(List<String> ids) async {
    final response = await _dio.post<Map<String, dynamic>>('/files/bulk-delete', data: {'ids': ids});
    final result = PersonaBulkDeleteResult.fromJson(response.data ?? const {});
    final deletedIds = result.deleted.toSet();
    emit(state.copyWith(files: state.files.where((f) => !deletedIds.contains(f.id)).toList()));
    return result;
  }

  /// Pure URL builder — no request. Suitable for `Image.network`/opening in
  /// a browser; auth (if the endpoint requires it) is the caller's concern.
  String getDownloadUrl(String id) => '${_config.baseUrl}/files/$id';

  DioMediaType? _mediaType(String? mimeType) {
    if (mimeType == null) return null;
    final parts = mimeType.split('/');
    if (parts.length != 2) return null;
    return DioMediaType(parts[0], parts[1]);
  }
}
