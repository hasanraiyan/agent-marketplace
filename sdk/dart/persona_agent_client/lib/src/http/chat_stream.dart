import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../models/models.dart';

/// Opens the `/chat` SSE stream and returns its raw byte stream. Injected
/// into `PersonaChatController` rather than hard-coded, so tests can supply
/// a fake returning `Stream.fromIterable([...])` built from fixture files —
/// no HTTP mocking library, no live backend needed to test the SSE-parsing/
/// state-machine logic.
typedef ChatStreamOpener =
    Future<Stream<List<int>>> Function(Map<String, dynamic> body, CancelToken cancelToken);

/// Default [ChatStreamOpener] — POSTs to `/chat` with
/// `responseType: ResponseType.stream`, matching the wire protocol
/// `useChat.ts`'s `fetch(...).body` reader consumes. `Accept:
/// text/event-stream` matches every other AG-UI consumer's request headers.
ChatStreamOpener createDioChatStreamOpener(Dio dio) {
  return (body, cancelToken) async {
    final response = await dio.post<ResponseBody>(
      '/chat',
      data: body,
      options: Options(
        responseType: ResponseType.stream,
        headers: const {'Accept': 'text/event-stream'},
      ),
      cancelToken: cancelToken,
    );
    return response.data!.stream;
  };
}

/// Decodes a raw SSE byte stream (`data: {...}\n` lines) into the AG-UI
/// event sequence. Splits by a single `\n` via [LineSplitter] — which
/// already buffers a partial trailing line across chunk boundaries — NOT by
/// `\n\n` blocks, matching `useChat.ts`'s own manual buffer-and-split loop
/// exactly. A malformed JSON line is swallowed (`continue`), not fatal, same
/// as the TS source's per-line try/catch.
Stream<PersonaStreamingEvent> parseChatEventStream(Stream<List<int>> byteStream) async* {
  final lines = byteStream.transform(utf8.decoder).transform(const LineSplitter());
  await for (final line in lines) {
    if (!line.startsWith('data:')) continue;
    final raw = line.substring(5).trim();
    if (raw == '[DONE]') break;
    if (raw.isEmpty) continue;

    Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) continue;
      json = decoded;
    } catch (_) {
      continue;
    }

    yield PersonaStreamingEvent.fromJson(json);
  }
}
