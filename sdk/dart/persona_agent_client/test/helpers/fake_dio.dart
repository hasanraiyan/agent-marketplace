import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A canned response for one (method, path) pair — enough for the
/// request/response CRUD controllers and `loadThreadMessages`, none of
/// which need a real network or a full HTTP mocking library.
class FakeResponse {
  const FakeResponse({this.statusCode = 200, this.body});

  final int statusCode;
  final Object? body;
}

/// Minimal [HttpClientAdapter] returning canned [FakeResponse]s keyed by
/// `"METHOD path"` (path only, query string ignored) — enough to test every
/// controller's request-building and response-shape-handling logic without
/// a live backend or an HTTP mocking dependency.
class FakeHttpClientAdapter implements HttpClientAdapter {
  FakeHttpClientAdapter(this._responses);

  final Map<String, FakeResponse> _responses;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final key = '${options.method} ${options.path}';
    final response = _responses[key];
    if (response == null) {
      throw DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 404),
        type: DioExceptionType.badResponse,
      );
    }
    final bytes = utf8.encode(jsonEncode(response.body));
    return ResponseBody.fromBytes(bytes, response.statusCode, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

Dio buildFakeDio(Map<String, FakeResponse> responses, {FakeHttpClientAdapter? adapter}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = adapter ?? FakeHttpClientAdapter(responses);
  return dio;
}
