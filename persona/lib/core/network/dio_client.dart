import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../config/api_constants.dart';
import 'dio_interceptors.dart';

/// Riverpod provider for the shared [Dio] HTTP client.
///
/// Use [ref.read(dioClientProvider)] or inject via constructor in
/// data-layer repositories.
final dioClientProvider = Provider<Dio>((ref) => DioClient.instance);

/// Singleton [Dio] client pre-configured with:
///
/// * Base URL from [ApiConstants.baseUrl]
/// * Timeouts
/// * [AuthInterceptor] — attaches Bearer token
/// * [LoggingInterceptor] — pretty-prints in debug mode
/// * [ErrorInterceptor] — maps HTTP errors to typed [AppException]s
class DioClient {
  DioClient._();

  static final Dio instance = _createDio();

  static Dio _createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: ApiConstants.connectTimeoutSeconds),
        receiveTimeout: const Duration(seconds: ApiConstants.receiveTimeoutSeconds),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        responseType: ResponseType.json,
      ),
    );

    // Order matters: Connectivity → Auth → Logging → Error.
    dio.interceptors.addAll([
      ConnectivityInterceptor(),
      AuthInterceptor(),
      LoggingInterceptor(Logger(printer: PrettyPrinter(methodCount: 0))),
      ErrorInterceptor(),
    ]);

    return dio;
  }
}
