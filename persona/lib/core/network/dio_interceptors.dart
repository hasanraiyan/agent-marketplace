import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';

import '../config/api_constants.dart';
import '../config/storage_keys.dart';
import '../storage/local_storage.dart';
import '../errors/exceptions.dart';
import '../../services/crash_reporting_service.dart';

// ── Auth Interceptor ─────────────────────────────────────────────────────────

/// Reads the stored access token and attaches it as an `Authorization` header
/// on every outgoing request.
///
/// On a 401 response the interceptor attempts a token refresh before
/// retrying the original request once.
class AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = LocalStorage.getString(StorageKeys.accessToken);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      // Attempt token refresh.
      try {
        final refreshToken = LocalStorage.getString(StorageKeys.refreshToken);

        if (refreshToken == null) {
          // No refresh token — propagate error; auth layer will handle logout.
          return handler.next(err);
        }

        final refreshDio = Dio(
          BaseOptions(
            baseUrl: ApiConstants.baseUrl,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );
        final response = await refreshDio.post(
          // For Clerk/Persona backend, token refresh endpoint should match API spec.
          // Adjust backend refresh path as needed.
          '/auth/refresh', 
          data: {'refreshToken': refreshToken},
        );

        final payload = response.data as Map<String, dynamic>;
        final innerData = payload['data'] as Map<String, dynamic>? ?? payload;
        final newToken =
            (innerData['accessToken'] ?? innerData['access_token']) as String;
        final newRefreshToken =
            (innerData['refreshToken'] ?? innerData['refresh_token'])
                as String?;

        await LocalStorage.setString(StorageKeys.accessToken, newToken);
        if (newRefreshToken != null) {
          await LocalStorage.setString(
            StorageKeys.refreshToken,
            newRefreshToken,
          );
        }

        // Retry the failed request with the new token.
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer $newToken';
        final clonedRequest = await Dio().fetch(opts);
        return handler.resolve(clonedRequest);
      } catch (_) {
        return handler.next(err);
      }
    }
    return handler.next(err);
  }
}

class ConnectivityInterceptor extends Interceptor {
  ConnectivityInterceptor({Connectivity? connectivity})
    : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final results = await _connectivity.checkConnectivity();
    final isOffline = results.every(
      (result) => result == ConnectivityResult.none,
    );

    if (isOffline) {
      return handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: const NetworkException(),
          message: 'No internet connection.',
        ),
      );
    }

    return handler.next(options);
  }
}

// ── Logging Interceptor ──────────────────────────────────────────────────────

/// Pretty-prints all requests and responses in debug mode.
class LoggingInterceptor extends Interceptor {
  LoggingInterceptor(this._logger);

  final Logger _logger;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _logger.d(
      '→ ${options.method} ${options.uri}\n'
      'Headers: ${options.headers}\n'
      'Body: ${options.data}',
    );
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    _logger.i(
      '← ${response.statusCode} ${response.requestOptions.uri}\n'
      'Data: ${response.data}',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final statusCode = err.response?.statusCode;
    final message =
        'HTTP $statusCode ${err.requestOptions.uri}\n${err.message}';

    if (statusCode != null && statusCode >= 400 && statusCode < 500) {
      _logger.w(message);
    } else {
      _logger.e(message, error: err);
    }
    handler.next(err);
  }
}

// ── Error Interceptor ────────────────────────────────────────────────────────

/// Maps Dio errors to typed [AppException] subclasses.
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final statusCode = err.response?.statusCode;
    final shouldReport =
        statusCode == null ||
        statusCode >= 500 ||
        err.type != DioExceptionType.badResponse;

    if (shouldReport) {
      unawaited(
        CrashReportingService.instance.recordError(
          err,
          err.stackTrace,
          reason: '${err.requestOptions.method} ${err.requestOptions.uri}',
        ),
      );
    }

    final exception = switch (err.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.sendTimeout => NetworkException(
        'Request timed out. Please check your connection.',
      ),
      DioExceptionType.connectionError => NetworkException(
        'No internet connection.',
      ),
      DioExceptionType.badResponse => _fromStatusCode(err.response),
      _ => UnexpectedException('An unexpected error occurred.'),
    };

    handler.reject(
      DioException(
        requestOptions: err.requestOptions,
        error: exception,
        response: err.response,
        type: err.type,
      ),
    );
  }

  AppException _fromStatusCode(Response? response) {
    final message = _extractMessage(response);
    return switch (response?.statusCode) {
      400 => ValidationException(message),
      401 => UnauthorizedException(message),
      403 => ForbiddenException(message),
      404 => NotFoundException(message),
      422 => ValidationException(message),
      500 || 502 || 503 => ServerException(message),
      _ => UnexpectedException(message),
    };
  }

  String _extractMessage(Response? response) {
    try {
      return response?.data['message'] as String? ?? 'Unknown error';
    } catch (_) {
      return 'Unknown error';
    }
  }
}
