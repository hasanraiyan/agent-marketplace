import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../../core/config/api_constants.dart';
import '../../../../core/network/dio_client.dart';

// ── AG-UI event types ─────────────────────────────────────────────────────────

enum AguiEventType {
  runStarted,
  runFinished,
  runError,
  textMessageStart,
  textMessageContent,
  textMessageEnd,
  toolCallStart,
  toolCallArgs,
  toolCallEnd,
  unknown,
}

class AguiEvent {
  const AguiEvent({
    required this.type,
    this.messageId,
    this.toolCallId,
    this.toolName,
    this.delta,
    this.args,
    this.error,
    this.raw,
  });

  final AguiEventType type;
  final String? messageId;
  final String? toolCallId;
  final String? toolName;
  final String? delta;
  final String? args;
  final String? error;
  final Map<String, dynamic>? raw;

  static AguiEvent fromJson(Map<String, dynamic> json) {
    final typeStr = (json['type'] as String? ?? '').toUpperCase();
    final eventType = switch (typeStr) {
      'RUN_STARTED' => AguiEventType.runStarted,
      'RUN_FINISHED' => AguiEventType.runFinished,
      'RUN_ERROR' => AguiEventType.runError,
      'TEXT_MESSAGE_START' => AguiEventType.textMessageStart,
      'TEXT_MESSAGE_CONTENT' => AguiEventType.textMessageContent,
      'TEXT_MESSAGE_END' => AguiEventType.textMessageEnd,
      'TOOL_CALL_START' => AguiEventType.toolCallStart,
      'TOOL_CALL_ARGS' => AguiEventType.toolCallArgs,
      'TOOL_CALL_END' => AguiEventType.toolCallEnd,
      _ => AguiEventType.unknown,
    };

    return AguiEvent(
      type: eventType,
      messageId: json['messageId'] as String?,
      toolCallId: json['toolCallId'] as String?,
      toolName: json['toolName'] as String?,
      delta: json['delta'] as String?,
      args: json['args'] is Map
          ? jsonEncode(json['args'])
          : json['args'] as String?,
      error: json['message'] as String? ?? json['error'] as String?,
      raw: json,
    );
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

class AguiService {
  /// Streams AG-UI SSE events from POST /agui.
  ///
  /// Thread-id and agent-id go in request headers per the backend contract.
  /// Authorization is attached automatically by [AuthInterceptor].
  Stream<AguiEvent> streamMessage({
    required String agentId,
    required String threadId,
    required String message,
  }) async* {
    final buffer = StringBuffer();

    final response = await DioClient.instance.post<ResponseBody>(
      ApiConstants.aguiStream,
      data: {
        'messages': [
          {'role': 'user', 'content': message},
        ],
      },
      options: Options(
        responseType: ResponseType.stream,
        headers: {
          'x-thread-id': threadId,
          'x-agent-id': agentId,
          'Accept': 'text/event-stream',
        },
      ),
    );

    final body = response.data;
    if (body == null) return;

    await for (final bytes in body.stream) {
      buffer.write(utf8.decode(bytes));
      final text = buffer.toString();

      // Process all complete SSE event blocks (separated by \n\n)
      final parts = text.split('\n\n');
      for (var i = 0; i < parts.length - 1; i++) {
        final block = parts[i].trim();
        if (block.isEmpty) continue;

        String? dataLine;
        for (final line in block.split('\n')) {
          if (line.startsWith('data: ')) {
            dataLine = line.substring(6).trim();
          }
        }

        if (dataLine == null || dataLine == '[DONE]') continue;

        try {
          final json = jsonDecode(dataLine) as Map<String, dynamic>;
          yield AguiEvent.fromJson(json);
        } catch (_) {
          // Skip malformed events
        }
      }

      buffer
        ..clear()
        ..write(parts.last);
    }
  }
}
