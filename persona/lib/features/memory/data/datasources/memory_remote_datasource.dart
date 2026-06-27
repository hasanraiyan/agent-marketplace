import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/memory_model.dart';

class MemoryRemoteDatasource {
  MemoryRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<MemoryDataModel>> getAllMemory() async {
    try {
      final response = await _dio.get(ApiConstants.memory);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: MemoryDataModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentMemoryEntryModel>> createMemory({
    required String agentId,
    required String key,
    required String value,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.memory,
        data: {'agentId': agentId, 'key': key, 'value': value},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: AgentMemoryEntryModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentMemoryEntryModel>> updateMemory({
    required String agentId,
    required String key,
    required String value,
  }) async {
    try {
      final response = await _dio.put(
        '${ApiConstants.memory}/${Uri.encodeComponent(agentId)}/${Uri.encodeComponent(key)}',
        data: {'value': value},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: AgentMemoryEntryModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteMemory({
    required String agentId,
    required String key,
  }) async {
    try {
      final response = await _dio.delete(
        '${ApiConstants.memory}/${Uri.encodeComponent(agentId)}/${Uri.encodeComponent(key)}',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Memory deleted',
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
