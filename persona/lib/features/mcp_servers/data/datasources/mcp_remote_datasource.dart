import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
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

  Future<ApiResponse<List<AgentModel>>> getUsedByAgents(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.mcps}/$id/agents');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as List? ?? [];
      final agents = payload
          .map((e) => AgentModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: agents);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<McpModel>> createMcp({
    required String name,
    required String description,
    required String transport,
    required String url,
    required String authType,
    required String authMode,
    String? apiKey,
    bool useDynamicRegistration = false,
    String? oauthClientId,
    String? oauthClientSecret,
    List<String> scopes = const [],
  }) async {
    try {
      final data = <String, dynamic>{
        'name': name,
        'description': description,
        'transport': transport,
        'url': url,
        'authType': authType,
        'authMode': authMode,
        'isEnabled': true,
      };

      if (authType == 'apiKey') {
        data['apiKey'] = apiKey;
      }
      if (authType == 'oauth') {
        data['useDynamicRegistration'] = useDynamicRegistration;
        if (!useDynamicRegistration) {
          data['oauth'] = {
            'clientId': oauthClientId,
            'clientSecret': oauthClientSecret,
            if (scopes.isNotEmpty) 'scopes': scopes,
          };
        }
      }

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
    String? description,
    String? transport,
    String? url,
    String? authType,
    String? authMode,
    bool? isEnabled,
    String? apiKey,
    bool? useDynamicRegistration,
    String? oauthClientId,
    String? oauthClientSecret,
    List<String>? scopes,
  }) async {
    try {
      final apiKeyPayload = apiKey?.isNotEmpty == true ? apiKey : null;
      final useDcrPayload = useDynamicRegistration;
      final data = <String, dynamic>{
        'name': ?name,
        'description': ?description,
        'transport': ?transport,
        'url': ?url,
        'authType': ?authType,
        'authMode': ?authMode,
        'isEnabled': ?isEnabled,
        'apiKey': ?apiKeyPayload,
        'useDynamicRegistration': ?useDcrPayload,
      };

      final clientIdPayload = oauthClientId?.isNotEmpty == true
          ? oauthClientId
          : null;
      final clientSecretPayload = oauthClientSecret?.isNotEmpty == true
          ? oauthClientSecret
          : null;
      final scopesPayload = scopes?.isNotEmpty == true ? scopes : null;
      final oauth = <String, dynamic>{
        'clientId': ?clientIdPayload,
        'clientSecret': ?clientSecretPayload,
        'scopes': ?scopesPayload,
      };
      if (oauth.isNotEmpty) data['oauth'] = oauth;

      final response = await _dio.patch('${ApiConstants.mcps}/$id', data: data);
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
        message: jsonMap['message'] as String? ?? 'MCP deleted',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<McpTestResult>> testMcp(String id) async {
    try {
      final response = await _dio.post('${ApiConstants.mcps}/$id/test');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? const {};
      return ApiResponse.success(data: McpTestResult.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<String>> getOwnerAuthorizeUrl(String id) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.mcps}/$id/oauth/owner/authorize',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? const {};
      return ApiResponse.success(data: payload['url']?.toString() ?? '');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<String>> getUserAuthorizeUrl(
    String id, {
    String? returnTo,
  }) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.mcps}/$id/oauth/user/authorize',
        queryParameters: {'returnTo': ?returnTo},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? const {};
      return ApiResponse.success(data: payload['url']?.toString() ?? '');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<bool>> getUserConnectionStatus(String id) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.mcps}/$id/oauth/user/status',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? const {};
      return ApiResponse.success(data: payload['connected'] as bool? ?? false);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> disconnectUserConnection(String id) async {
    try {
      final response = await _dio.delete(
        '${ApiConstants.mcps}/$id/oauth/user/connection',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Disconnected',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> disconnectOwnerConnection(String id) async {
    try {
      final response = await _dio.delete(
        '${ApiConstants.mcps}/$id/oauth/owner/connection',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Disconnected',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
