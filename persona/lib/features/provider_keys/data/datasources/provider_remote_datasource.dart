import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/provider_model.dart';

class ProviderRemoteDatasource {
  ProviderRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<List<ProviderModel>>> getProviders() async {
    try {
      final response = await _dio.get(ApiConstants.providers);
      final jsonMap = response.data as Map<String, dynamic>;
      
      final payload = jsonMap['data'] as List? ?? jsonMap['providers'] as List? ?? [];
      final list = payload.map((e) => ProviderModel.fromJson(e as Map<String, dynamic>)).toList();

      return ApiResponse.success(
        data: list,
        message: jsonMap['message'] as String? ?? 'Providers loaded successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<ProviderModel>> createProvider({
    required String label,
    required String baseURL,
    required String apiKey,
    required String defaultModel,
    bool? isDefault,
  }) async {
    try {
      final dataMap = <String, dynamic>{
        'label': label,
        'baseURL': baseURL,
        'apiKey': apiKey,
        'defaultModel': defaultModel,
      };
      if (isDefault != null) dataMap['isDefault'] = isDefault;

      final response = await _dio.post(
        ApiConstants.providers,
        data: dataMap,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;

      return ApiResponse.success(
        data: ProviderModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Provider credentials saved',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<ProviderModel>> updateProvider(
    String id, {
    String? label,
    String? baseURL,
    String? apiKey,
    String? defaultModel,
    bool? isDefault,
  }) async {
    try {
      final dataMap = <String, dynamic>{};
      if (label != null) dataMap['label'] = label;
      if (baseURL != null) dataMap['baseURL'] = baseURL;
      if (apiKey != null) dataMap['apiKey'] = apiKey;
      if (defaultModel != null) dataMap['defaultModel'] = defaultModel;
      if (isDefault != null) dataMap['isDefault'] = isDefault;

      final response = await _dio.put(
        '${ApiConstants.providers}/$id',
        data: dataMap,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;

      return ApiResponse.success(
        data: ProviderModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Provider updated successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteProvider(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.providers}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Provider credentials deleted',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<bool>> testConnection({
    required String label,
    required String baseURL,
    required String apiKey,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.providers}/test-connection',
        data: {
          'label': label,
          'baseURL': baseURL,
          'apiKey': apiKey,
        },
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final success = jsonMap['success'] as bool? ?? true;
      return ApiResponse.success(
        data: success,
        message: jsonMap['message'] as String? ?? 'Connection test completed',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<bool>> testExistingConnection(String id) async {
    try {
      final response = await _dio.post('${ApiConstants.providers}/$id/test');
      final jsonMap = response.data as Map<String, dynamic>;
      final success = jsonMap['success'] as bool? ?? true;
      return ApiResponse.success(
        data: success,
        message: jsonMap['message'] as String? ?? 'Connection test completed',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<String>>> getProviderModels(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.providers}/$id/models');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as List? ?? jsonMap['models'] as List? ?? [];
      final list = payload.map((e) => e.toString()).toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
