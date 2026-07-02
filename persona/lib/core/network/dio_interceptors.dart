import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';

import '../auth/clerk_token_store.dart';
import '../errors/exceptions.dart';
import '../../services/crash_reporting_service.dart';

// ── Auth Interceptor ─────────────────────────────────────────────────────────

/// Attaches the active Clerk session token as a `Bearer` header on every
/// outgoing request.
///
/// On a 401 the interceptor asks Clerk for a fresh token (Clerk handles
/// expiry and rotation internally) and retries the original request once.
/// If no session is active the 401 propagates to the error layer.
class AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await ClerkTokenStore.instance.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    // Bypass ngrok browser-warning interstitial page
    options.headers['ngrok-skip-browser-warning'] = 'true';
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      try {
        // Clerk keeps the session fresh internally; a second call returns a
        // new JWT if the previous one was close to expiry.
        final freshToken = await ClerkTokenStore.instance.getToken();
        if (freshToken != null && freshToken.isNotEmpty) {
          final retryOptions = err.requestOptions
            ..headers['Authorization'] = 'Bearer $freshToken';
          final response = await Dio().fetch(retryOptions);
          return handler.resolve(response);
        }
      } catch (_) {
        // Fall through — let the 401 propagate
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
