import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:test/test.dart';

import 'helpers/fake_dio.dart';

/// Builds a [ChatStreamOpener] that ignores the request and always replays
/// the given SSE lines — enough to drive [PersonaChatController]'s whole
/// state machine without a live backend or an HTTP mocking dependency,
/// exactly the injection point the plan calls for.
ChatStreamOpener fakeOpener(List<String> lines, {Object? throwOnOpen}) {
  return (body, cancelToken) async {
    if (throwOnOpen != null) throw throwOnOpen;
    final bytes = utf8.encode('${lines.join('\n')}\n');
    return Stream.value(bytes);
  };
}

PersonaConfig _config() => PersonaConfig(baseUrl: 'https://example.test');

void main() {
  group('PersonaChatController.sendMessage', () {
    test('inserts an optimistic user message + streaming placeholder before any network call', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener(['data: {"type":"TEXT_MESSAGE_CHUNK","delta":"hi"}', 'data: [DONE]']),
      );

      final future = controller.sendMessage('hello');
      // Synchronous append already happened before the await above yields.
      expect(controller.state.messages, hasLength(2));
      expect(controller.state.messages[0].role, PersonaRole.user);
      expect(controller.state.messages[0].content, 'hello');
      expect(controller.state.messages[1].role, PersonaRole.assistant);
      expect(controller.state.messages[1].isStreaming, isTrue);
      expect(controller.state.input, '');
      expect(controller.state.isStreaming, isTrue);

      await future;
      controller.dispose();
    });

    test('accumulates TEXT_MESSAGE_CHUNK deltas into one final message and calls onFinish', () async {
      PersonaMessage? finished;
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        onFinish: (m) => finished = m,
        chatStreamOpener: fakeOpener([
          'data: {"type":"TEXT_MESSAGE_CHUNK","delta":"Hello"}',
          'data: {"type":"TEXT_MESSAGE_CHUNK","delta":", world"}',
          'data: [DONE]',
        ]),
      );

      await controller.sendMessage('hi');

      expect(controller.state.isStreaming, isFalse);
      expect(controller.state.messages.last.content, 'Hello, world');
      expect(controller.state.messages.last.isStreaming, isFalse);
      expect(finished?.content, 'Hello, world');
      controller.dispose();
    });

    test('accumulates TOOL_CALL_CHUNK args by toolCallId and sets the result from TOOL_CALL_RESULT', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener([
          'data: {"type":"TOOL_CALL_CHUNK","toolCallId":"call_1","toolCallName":"search_web","delta":"{\\"q\\":"}',
          'data: {"type":"TOOL_CALL_CHUNK","toolCallId":"call_1","delta":"1}"}',
          'data: {"type":"TOOL_CALL_RESULT","toolCallId":"call_1","content":"ok"}',
          'data: [DONE]',
        ]),
      );

      await controller.sendMessage('search');

      final toolCall = controller.state.messages.last.toolCalls!.single;
      expect(toolCall.toolCallId, 'call_1');
      expect(toolCall.toolName, 'search_web');
      expect(toolCall.args, '{"q":1}');
      expect(toolCall.result, 'ok');
      expect(toolCall.isError, isFalse);
      controller.dispose();
    });

    test('a JSON {status:"error"} TOOL_CALL_RESULT marks the tool call as errored', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener([
          'data: {"type":"TOOL_CALL_CHUNK","toolCallId":"call_1","toolCallName":"write_file","delta":"{}"}',
          'data: {"type":"TOOL_CALL_RESULT","toolCallId":"call_1","content":"{\\"status\\":\\"error\\",\\"message\\":\\"boom\\"}"}',
          'data: [DONE]',
        ]),
      );

      await controller.sendMessage('write');

      expect(controller.state.messages.last.toolCalls!.single.isError, isTrue);
      controller.dispose();
    });

    test('folds subagent_activity CUSTOM events onto the matching tool call', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener([
          'data: {"type":"TOOL_CALL_CHUNK","toolCallId":"call_task","toolCallName":"task","delta":"{}"}',
          'data: {"type":"CUSTOM","name":"subagent_activity","value":{"toolCallId":"call_task","kind":"text","delta":"working..."}}',
          'data: [DONE]',
        ]),
      );

      await controller.sendMessage('run subagent');

      final toolCall = controller.state.messages.last.toolCalls!.single;
      expect(toolCall.subagentActivity, hasLength(1));
      expect(toolCall.subagentActivity!.single.kind, PersonaSubagentActivityKind.text);
      expect(toolCall.subagentActivity!.single.delta, 'working...');
      controller.dispose();
    });

    test('a hitl_request CUSTOM event sets state.interrupt', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener([
          'data: {"type":"CUSTOM","name":"hitl_request","value":{"actionRequests":[{"name":"delete_file"}],"reviewConfigs":[]}}',
          'data: [DONE]',
        ]),
      );

      await controller.sendMessage('delete it');

      expect(controller.state.interrupt, isA<PersonaHitlInterrupt>());
      controller.dispose();
    });

    test('RUN_ERROR sets state.error, calls onError, and settles the placeholder', () async {
      Object? caught;
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        onError: (e) => caught = e,
        chatStreamOpener: fakeOpener([
          'data: {"type":"RUN_ERROR","code":"X","message":"boom"}',
        ]),
      );

      await controller.sendMessage('fail please');

      expect(controller.state.isStreaming, isFalse);
      expect(controller.state.error, isNotNull);
      expect(caught, isA<PersonaRunErrorException>());
      expect(controller.state.messages.last.content, contains('boom'));
      expect(controller.state.messages.last.isStreaming, isFalse);
      controller.dispose();
    });

    test('cancellation (stop()) is not an error — settles the placeholder without setting error', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: (body, cancelToken) async {
          // A stream that never emits on its own — genuinely errors only
          // once stop() cancels the token, exactly like a real in-flight
          // Dio request being aborted mid-stream.
          final streamController = StreamController<List<int>>();
          cancelToken.whenCancel.then((_) {
            streamController.addError(
              DioException(requestOptions: RequestOptions(path: '/chat'), type: DioExceptionType.cancel),
            );
            streamController.close();
          });
          return streamController.stream;
        },
      );

      final future = controller.sendMessage('hang forever');
      controller.stop();
      await future;

      expect(controller.state.isStreaming, isFalse);
      expect(controller.state.error, isNull);
      controller.dispose();
    });

    test('does nothing for blank input or while already streaming', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener(['data: [DONE]']),
      );

      await controller.sendMessage('   ');
      expect(controller.state.messages, isEmpty);

      final first = controller.sendMessage('one');
      // Still streaming synchronously right after the call starts.
      final second = controller.sendMessage('two');
      await Future.wait([first, second]);
      // Only the first call's user message should have gone through.
      expect(controller.state.messages.where((m) => m.role == PersonaRole.user), hasLength(1));
      controller.dispose();
    });

    test('throws when no agentId is available from any source', () {
      final controller = PersonaChatController(
        config: _config(),
        chatStreamOpener: fakeOpener(['data: [DONE]']),
      );

      expect(() => controller.sendMessage('hi'), throwsStateError);
      controller.dispose();
    });
  });

  group('PersonaChatController.reload', () {
    test('truncates back to before the last user message and resends it', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener(['data: {"type":"TEXT_MESSAGE_CHUNK","delta":"ok"}', 'data: [DONE]']),
      );
      await controller.sendMessage('first question');
      final messagesBeforeReload = controller.state.messages.length;
      expect(messagesBeforeReload, 2);

      await controller.reload();

      expect(controller.state.messages, hasLength(2));
      expect(controller.state.messages.first.content, 'first question');
      controller.dispose();
    });
  });

  group('PersonaChatController.clear', () {
    test('resets all state to empty', () async {
      final controller = PersonaChatController(
        config: _config(),
        agentId: 'agent-1',
        chatStreamOpener: fakeOpener(['data: {"type":"TEXT_MESSAGE_CHUNK","delta":"ok"}', 'data: [DONE]']),
      );
      await controller.sendMessage('hi');
      expect(controller.state.messages, isNotEmpty);

      controller.clear();

      expect(controller.state.messages, isEmpty);
      expect(controller.state.isStreaming, isFalse);
      controller.dispose();
    });
  });

  group('PersonaChatController.loadThreadMessages', () {
    test('re-keys subagentTraces onto the matching tool call and normalizes files/todos', () async {
      final dio = buildFakeDio({
        'GET /threads/t1/messages': FakeResponse(
          body: {
            'messages': [
              {'id': 'm1', 'role': 'user', 'content': 'hi'},
              {
                'id': 'm2',
                'role': 'assistant',
                'content': '',
                'toolCalls': [
                  {'toolCallId': 'call_task', 'toolName': 'task', 'args': '{}', 'result': 'done'},
                ],
              },
            ],
            'subagentTraces': {
              'call_task': [
                {'type': 'text', 'text': 'thinking'},
              ],
            },
            'state': {
              'files': {
                '/a.md': {'content': 'hi', 'size': 2, 'created_at': null, 'modified_at': null},
              },
              'todos': [
                {'content': 'write docs', 'status': 'pending'},
              ],
            },
          },
        ),
      });
      final controller = PersonaChatController(config: _config(), dio: dio);

      final messages = await controller.loadThreadMessages('t1');

      expect(messages, hasLength(2));
      final toolCall = messages[1].toolCalls!.single;
      expect(toolCall.subagentActivity, hasLength(1));
      expect(toolCall.subagentActivity!.single.delta, 'thinking');
      expect(controller.state.files.containsKey('/a.md'), isTrue);
      expect(controller.state.todos.single.content, 'write docs');
      controller.dispose();
    });

    test('sets state.interrupt from a pendingInterrupt envelope', () async {
      final dio = buildFakeDio({
        'GET /threads/t1/messages': FakeResponse(
          body: {
            'messages': <Map<String, dynamic>>[],
            'pendingInterrupt': {
              'kind': 'clarification',
              'value': {
                'questions': [
                  {'id': 'q1', 'text': 'Which?', 'options': [], 'required': true, 'allowCustom': false},
                ],
              },
            },
          },
        ),
      });
      final controller = PersonaChatController(config: _config(), dio: dio);

      await controller.loadThreadMessages('t1');

      expect(controller.state.interrupt, isA<PersonaClarificationInterrupt>());
      controller.dispose();
    });

    test('sets state.error and returns an empty list when the request fails', () async {
      final dio = buildFakeDio({});
      final controller = PersonaChatController(config: _config(), dio: dio);

      final messages = await controller.loadThreadMessages('missing-thread');

      expect(messages, isEmpty);
      expect(controller.state.error, isNotNull);
      expect(controller.state.isLoadingHistory, isFalse);
      controller.dispose();
    });
  });
}
