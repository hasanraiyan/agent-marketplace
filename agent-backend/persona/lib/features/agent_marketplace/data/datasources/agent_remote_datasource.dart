import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/agent_model.dart';

class AgentRemoteDatasource {
  AgentRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<List<AgentModel>>> searchAgents({
    String? query,
    String? category,
    String? visibility,
    int? page,
    int? limit,
  }) async {
    try {
      final dataMap = <String, dynamic>{};
      if (query != null) dataMap['query'] = query;
      if (category != null) dataMap['category'] = category;
      if (visibility != null) dataMap['visibility'] = visibility;
      if (page != null) dataMap['page'] = page;
      if (limit != null) dataMap['limit'] = limit;

      final response = await _dio.post(
        ApiConstants.agentsSearch,
        data: dataMap,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      
      final payload = jsonMap['data'] as List? ?? jsonMap['agents'] as List? ?? [];
      final list = payload.map((e) => AgentModel.fromJson(e as Map<String, dynamic>)).toList();
      
      return ApiResponse.success(
        data: list,
        message: jsonMap['message'] as String? ?? 'Agents fetched successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<int>> countAgents({
    String? query,
    String? category,
    String? visibility,
  }) async {
    try {
      final dataMap = <String, dynamic>{};
      if (query != null) dataMap['query'] = query;
      if (category != null) dataMap['category'] = category;
      if (visibility != null) dataMap['visibility'] = visibility;

      final response = await _dio.post(
        ApiConstants.agentsCount,
        data: dataMap,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      final count = payload['count'] as int? ?? 0;

      return ApiResponse.success(
        data: count,
        message: jsonMap['message'] as String? ?? 'Count fetched successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentModel>> getAgentBySlug(String slug) async {
    try {
      final response = await _dio.get('${ApiConstants.agents}/slug/$slug');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      
      return ApiResponse.success(
        data: AgentModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Agent details loaded',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentModel>> getAgentById(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.agents}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      
      return ApiResponse.success(
        data: AgentModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Agent details loaded',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentModel>> createAgent(Map<String, dynamic> agentData) async {
    try {
      final response = await _dio.post(
        ApiConstants.agents,
        data: agentData,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      
      return ApiResponse.success(
        data: AgentModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Agent created successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<AgentModel>> updateAgent(String id, Map<String, dynamic> agentData) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.agents}/$id',
        data: agentData,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      
      return ApiResponse.success(
        data: AgentModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Agent updated successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteAgent(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.agents}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Agent deleted successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> getAgentMemory(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.agents}/$id/memory');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap['memory'] as Map<String, dynamic>? ?? {};
      return ApiResponse.success(data: payload);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteAgentMemory(String id, String key) async {
    try {
      final response = await _dio.delete('${ApiConstants.agents}/$id/memory/$key');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Memory key deleted successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
