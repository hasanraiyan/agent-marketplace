import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/knowledge_model.dart';

class KnowledgeRemoteDatasource {
  KnowledgeRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<List<KnowledgeBaseModel>>> getKnowledgeBases() async {
    try {
      final response = await _dio.get(ApiConstants.knowledge);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['knowledgeBases'] as List? ?? [];
      final list = payload
          .map((e) => KnowledgeBaseModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<KnowledgeBaseModel>> getKnowledgeBaseById(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.knowledge}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: KnowledgeBaseModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<KnowledgeBaseModel>> createKnowledgeBase({
    required String name,
    required String description,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.knowledge,
        data: {'name': name, 'description': description},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: KnowledgeBaseModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<KnowledgeBaseModel>> updateKnowledgeBase(
    String id, {
    String? name,
    String? description,
  }) async {
    try {
      final data = <String, dynamic>{
        'name': ?name,
        'description': ?description,
      };
      final response =
          await _dio.patch('${ApiConstants.knowledge}/$id', data: data);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: KnowledgeBaseModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteKnowledgeBase(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.knowledge}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
          message: jsonMap['message'] as String? ?? 'Knowledge base deleted');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<KnowledgeDocumentModel>>> getDocuments(
      String kbId) async {
    try {
      final response =
          await _dio.get('${ApiConstants.knowledge}/$kbId/documents');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['documents'] as List? ?? [];
      final list = payload
          .map((e) =>
              KnowledgeDocumentModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<KnowledgeDocumentModel>> uploadDocument(
      String kbId, String sourceUrl) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.knowledge}/$kbId/documents',
        data: {'sourceUrl': sourceUrl},
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(
          data: KnowledgeDocumentModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteDocument(
      String kbId, String sourceName) async {
    try {
      final encodedName = Uri.encodeComponent(sourceName);
      final response = await _dio.delete(
          '${ApiConstants.knowledge}/$kbId/documents/$encodedName');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
          message: jsonMap['message'] as String? ?? 'Document deleted');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
