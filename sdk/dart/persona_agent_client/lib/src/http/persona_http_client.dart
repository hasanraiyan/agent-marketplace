import 'package:dio/dio.dart';

import '../config.dart';

/// Builds a [Dio] instance pointed at [PersonaConfig.baseUrl] with an
/// interceptor that awaits `getAuthToken()` on every request and sets
/// `Authorization: Bearer <token>` when present — the Dart equivalent of
/// `PersonaContext.tsx`'s `fetchWithAuth`. Every controller in this package
/// shares one instance built this way rather than constructing its own
/// [Dio], so auth injection is never duplicated or forgotten.
Dio createPersonaHttpClient(PersonaConfig config) {
  final dio = Dio(
    BaseOptions(baseUrl: config.baseUrl, headers: const {'Content-Type': 'application/json'}),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await config.getAuthToken?.call();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );

  return dio;
}
