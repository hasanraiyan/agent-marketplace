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

  Future<ApiResponse<KnowledgeBaseModel>> getKnowledgeBaseById(
    String id,
  ) async {
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
    required String providerId,
    required String embeddingModel,
    required int chunkSize,
    required int chunkOverlap,
    required int topK,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.knowledge,
        data: {
          'name': name,
          'description': description,
          'providerId': providerId,
          'embeddingModel': embeddingModel,
          'chunkSize': chunkSize,
          'chunkOverlap': chunkOverlap,
          'topK': topK,
        },
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
      final response = await _dio.patch(
        '${ApiConstants.knowledge}/$id',
        data: data,
      );
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
        message: jsonMap['message'] as String? ?? 'Knowledge base deleted',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<KnowledgeDocumentModel>>> getDocuments(
    String kbId,
  ) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.knowledge}/$kbId/documents',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['documents'] as List? ?? [];
      final list = payload
          .map(
            (e) => KnowledgeDocumentModel.fromJson(e as Map<String, dynamic>),
          )
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> uploadFiles(
    String kbId,
    List<String> paths, {
    ProgressCallback? onSendProgress,
  }) async {
    try {
      final files = paths
          .map(
            (path) =>
                MultipartFile.fromFileSync(path, filename: _filename(path)),
          )
          .toList();
      final formData = FormData.fromMap({'files': files});
      final response = await _dio.post(
        '${ApiConstants.knowledge}/$kbId/upload',
        data: formData,
        onSendProgress: onSendProgress,
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Files uploaded',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteDocument(
    String kbId,
    String sourceName,
  ) async {
    try {
      final encodedName = Uri.encodeComponent(sourceName);
      final response = await _dio.delete(
        '${ApiConstants.knowledge}/$kbId/documents/$encodedName',
      );
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Document deleted',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  String _filename(String path) => path.split(RegExp(r'[\\/]')).last;

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
