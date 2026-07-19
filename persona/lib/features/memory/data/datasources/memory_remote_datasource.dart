import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/memory_model.dart';

/// File-based memory datasource.
///
/// Backend endpoints:
///   GET    /memory              → { userFiles, agentMemories }
///   PUT    /memory/file          → { scope, agentId?, path, content } → created file
///   DELETE /memory/file          → query: scope, agentId?, path
///   DELETE /memory/all           → clear everything
class MemoryRemoteDatasource {
  MemoryRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<AllMemoryDataModel>> getAllMemory() async {
    try {
      final response = await _dio.get(ApiConstants.memory);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: AllMemoryDataModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<MemoryFileModel>> writeMemoryFile({
    String scope = 'user',
    String? agentId,
    required String path,
    required String content,
  }) async {
    try {
      final response = await _dio.put(
        '${ApiConstants.memory}/file',
        data: {
          'scope': scope,
          if (agentId != null && scope == 'agent') 'agentId': agentId,
          'path': path,
          'content': content,
        },
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: MemoryFileModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteMemoryFile({
    String scope = 'user',
    String? agentId,
    required String path,
  }) async {
    try {
      final response = await _dio.delete(
        '${ApiConstants.memory}/file',
        queryParameters: {
          'scope': scope,
          if (agentId != null && scope == 'agent') 'agentId': agentId,
          'path': path,
        },
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Memory file deleted',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> clearAllMemory() async {
    try {
      final response = await _dio.delete('${ApiConstants.memory}/all');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'All memory cleared',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
