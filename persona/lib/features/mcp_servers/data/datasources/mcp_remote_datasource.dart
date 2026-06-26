import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/mcp_model.dart';

class McpRemoteDatasource {
  McpRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<List<McpModel>>> getMcps() async {
    try {
      final response = await _dio.get(ApiConstants.mcps);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['mcps'] as List? ?? [];
      final list = payload
          .map((e) => McpModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<McpModel>> getMcpById(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.mcps}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: McpModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<McpModel>> createMcp({
    required String name,
    required String serverUrl,
    required String authType,
    String? apiKey,
  }) async {
    try {
      final data = <String, dynamic>{
        'name': name,
        'serverUrl': serverUrl,
        'authType': authType,
        'apiKey': ?apiKey,
      };
      final response = await _dio.post(ApiConstants.mcps, data: data);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: McpModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<McpModel>> updateMcp(
    String id, {
    String? name,
    String? serverUrl,
    String? authType,
    String? apiKey,
  }) async {
    try {
      final data = <String, dynamic>{
        'name': ?name,
        'serverUrl': ?serverUrl,
        'authType': ?authType,
        'apiKey': ?apiKey,
      };
      final response =
          await _dio.patch('${ApiConstants.mcps}/$id', data: data);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: McpModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteMcp(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.mcps}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
          message: jsonMap['message'] as String? ?? 'MCP deleted');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<bool>> testMcp(String id) async {
    try {
      final response =
          await _dio.post('${ApiConstants.mcps}/$id/test');
      final jsonMap = response.data as Map<String, dynamic>;
      final success = jsonMap['success'] as bool? ?? true;
      return ApiResponse.success(data: success);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
