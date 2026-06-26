import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/skill_model.dart';

class SkillRemoteDatasource {
  SkillRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<List<SkillModel>>> getMySkills() async {
    try {
      final response = await _dio.get(ApiConstants.skills);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['skills'] as List? ?? [];
      final list = payload
          .map((e) => SkillModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<List<SkillModel>>> getPublicSkills() async {
    try {
      final response = await _dio.get('${ApiConstants.skills}/public');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload =
          jsonMap['data'] as List? ?? jsonMap['skills'] as List? ?? [];
      final list = payload
          .map((e) => SkillModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(data: list);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<SkillModel>> getSkillById(String id) async {
    try {
      final response = await _dio.get('${ApiConstants.skills}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: SkillModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<SkillModel>> createSkill({
    required String name,
    required String description,
    required String instructions,
    required List<Map<String, dynamic>> codeSnippets,
    required bool isPublic,
  }) async {
    try {
      final data = {
        'name': name,
        'description': description,
        'instructions': instructions,
        'codeSnippets': codeSnippets,
        'isPublic': isPublic,
      };
      final response = await _dio.post(ApiConstants.skills, data: data);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: SkillModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<SkillModel>> updateSkill(
    String id, {
    String? name,
    String? description,
    String? instructions,
    List<Map<String, dynamic>>? codeSnippets,
    bool? isPublic,
  }) async {
    try {
      final data = <String, dynamic>{
        'name': ?name,
        'description': ?description,
        'instructions': ?instructions,
        'codeSnippets': ?codeSnippets,
        'isPublic': ?isPublic,
      };
      final response =
          await _dio.patch('${ApiConstants.skills}/$id', data: data);
      final jsonMap = response.data as Map<String, dynamic>;
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(data: SkillModel.fromJson(payload));
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteSkill(String id) async {
    try {
      final response = await _dio.delete('${ApiConstants.skills}/$id');
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
          message: jsonMap['message'] as String? ?? 'Skill deleted');
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
