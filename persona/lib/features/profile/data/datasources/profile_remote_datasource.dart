import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_response.dart';
import '../models/user_model.dart';

class ProfileRemoteDatasource {
  ProfileRemoteDatasource(this._dio);

  final Dio _dio;

  Future<ApiResponse<UserModel>> getProfile() async {
    try {
      final response = await _dio.get(ApiConstants.profile);
      final jsonMap = response.data as Map<String, dynamic>;
      
      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(
        data: UserModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Profile loaded successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<UserModel>> updateProfile({
    String? name,
    int? age,
    Map<String, String>? preferences,
    String? summary,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (name != null) data['name'] = name;
      if (age != null) data['age'] = age;
      
      final profile = <String, dynamic>{};
      if (preferences != null) profile['preferences'] = preferences;
      if (summary != null) profile['summary'] = summary;
      if (profile.isNotEmpty) data['profile'] = profile;

      final response = await _dio.patch(
        ApiConstants.profile,
        data: data,
      );
      final jsonMap = response.data as Map<String, dynamic>;

      final payload = jsonMap['data'] as Map<String, dynamic>? ?? jsonMap;
      return ApiResponse.success(
        data: UserModel.fromJson(payload),
        message: jsonMap['message'] as String? ?? 'Profile updated successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<ApiResponse<void>> deleteProfile() async {
    try {
      final response = await _dio.delete(ApiConstants.profile);
      final jsonMap = response.data as Map<String, dynamic>;
      return ApiResponse.success(
        message: jsonMap['message'] as String? ?? 'Profile deleted successfully',
      );
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  AppException _handle(DioException e) => e.error is AppException
      ? e.error as AppException
      : UnexpectedException(e.message ?? 'Unknown error');
}
