import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/thread_model.dart';
import '../models/message_model.dart';

class ThreadRemoteDatasource {
  ThreadRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<ThreadModel>> createThread({
    required String agentId,
    String? title,
  }) async {
    try {
      final dataMap = <String, dynamic>{
        'agentId': agentId,
      };
      if (title != null) dataMap['title'] = title;

      final response = await _dio.post(
        ApiConstants.threads,
        data: dataMap,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;

      return ApiResponse.success(
        data: ThreadModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Thread created successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<ThreadModel>>> getThreads() async {
    try {
      final response = await _dio.get(ApiConstants.threads);
      final jsonMap = response.data as Map<String, dynamic>;
      
      final payload = jsonMap['data'] as List? ?? jsonMap['threads'] as List? ?? [];
      final list = payload.map((e) => ThreadModel.fromJson(e as Map<String, dynamic>)).toList();

      return ApiResponse.success(
        data: list,
        message: jsonMap['message'] as String? ?? 'Threads loaded successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<ThreadModel>> getThreadById(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.threads}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;

      return ApiResponse.success(
        data: ThreadModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Thread loaded',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<ThreadModel>> updateThreadTitle(String id, String title) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.threads}/$id/title',
        data: {'title': title},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;

      return ApiResponse.success(
        data: ThreadModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Thread title updated',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteThread(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.threads}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Thread deleted successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteAllThreads() async {
    try {
      final response = await _dio.delete(ApiConstants.threads);
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'All threads cleared',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<MessageModel>>> getThreadMessages(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.threads}/$id/messages');
      final jsonMap = response.data as Map<String, dynamic>;
      
      final payload = jsonMap['data'] as List? ?? jsonMap['messages'] as List? ?? [];
      final list = payload.map((e) => MessageModel.fromJson(e as Map<String, dynamic>)).toList();

      return ApiResponse.success(
        data: list,
        message: jsonMap['message'] as String? ?? 'Messages loaded successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
