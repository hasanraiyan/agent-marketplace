import 'dart:convert';
import 'dart:io';

import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:persona_agent_client/src/http/chat_stream.dart';
import 'package:test/test.dart';

/// Loads a fixture file and splits it into byte chunks at every 7th byte —
/// deliberately misaligned with line boundaries, so a passing test also
/// proves [parseChatEventStream]'s [LineSplitter] correctly buffers a
/// partial trailing line across chunk boundaries, not just when each SSE
/// line happens to arrive whole in one read.
Stream<List<int>> _fixtureStream(String name) {
  final bytes = File('test/fixtures/$name').readAsBytesSync();
  final chunks = <List<int>>[];
  for (var i = 0; i < bytes.length; i += 7) {
    chunks.add(bytes.sublist(i, i + 7 > bytes.length ? bytes.length : i + 7));
  }
  return Stream.fromIterable(chunks);
}

void main() {
  group('parseChatEventStream', () {
    test('decodes a plain text stream', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_basic_text.txt')).toList();

      expect(events, [
        isA<PersonaRunStartedEvent>(),
        isA<PersonaTextMessageChunkEvent>().having((e) => e.delta, 'delta', 'Hello'),
        isA<PersonaTextMessageChunkEvent>().having((e) => e.delta, 'delta', ', world'),
        isA<PersonaTextMessageChunkEvent>().having((e) => e.delta, 'delta', '!'),
        isA<PersonaRunFinishedEvent>(),
      ]);
    });

    test('decodes chunked tool-call args followed by a result', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_tool_call_chunks.txt')).toList();

      expect(events, [
        isA<PersonaToolCallChunkEvent>()
            .having((e) => e.toolCallId, 'toolCallId', 'call_1')
            .having((e) => e.toolCallName, 'toolCallName', 'search_web'),
        isA<PersonaToolCallChunkEvent>().having((e) => e.toolCallId, 'toolCallId', 'call_1'),
        isA<PersonaToolCallResultEvent>()
            .having((e) => e.toolCallId, 'toolCallId', 'call_1')
            .having((e) => e.content, 'content', '{"results":[]}'),
        isA<PersonaTextMessageChunkEvent>(),
      ]);
    });

    test('decodes a reasoning start/content/end sequence', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_reasoning.txt')).toList();

      expect(events[0], isA<PersonaReasoningStartEvent>());
      expect(
        events[1],
        isA<PersonaReasoningContentEvent>().having((e) => e.delta, 'delta', 'Let me think'),
      );
      expect(events[3], isA<PersonaReasoningEndEvent>());
      expect(events[4], isA<PersonaTextMessageChunkEvent>());
    });

    test('decodes a hitl_request CUSTOM event', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_hitl_interrupt.txt')).toList();
      final hitl = events.whereType<PersonaHitlRequestEvent>().single;

      expect(hitl.actionRequests, hasLength(1));
      expect(hitl.actionRequests.single.name, 'delete_file');
    });

    test('decodes a clarification_request CUSTOM event', () async {
      final events = await parseChatEventStream(
        _fixtureStream('sse_clarification_interrupt.txt'),
      ).toList();
      final clarification = events.whereType<PersonaClarificationRequestEvent>().single;

      expect(clarification.questions.single.text, 'Which account?');
      expect(clarification.questions.single.options, ['Checking', 'Savings']);
    });

    test('decodes subagent_activity CUSTOM events tied to their toolCallId', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_subagent_activity.txt')).toList();
      final activity = events.whereType<PersonaSubagentActivityEvent>().toList();

      expect(activity, hasLength(2));
      expect(activity[0].toolCallId, 'call_task');
      expect(activity[0].entry.kind, PersonaSubagentActivityKind.toolStart);
      expect(activity[1].entry.kind, PersonaSubagentActivityKind.toolResult);
    });

    test('decodes a STATE_SNAPSHOT event with raw (unnormalized) files/todos', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_state_snapshot.txt')).toList();
      final snapshot = events.whereType<PersonaStateSnapshotEvent>().single;

      expect(snapshot.rawFiles.keys, ['/a.md']);
      expect(snapshot.rawTodos, hasLength(1));
    });

    test('decodes a RUN_ERROR event with no trailing [DONE]', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_run_error.txt')).toList();

      expect(events[0], isA<PersonaTextMessageChunkEvent>());
      final error = events[1] as PersonaRunErrorEvent;
      expect(error.code, 'PROVIDER_ERROR');
      expect(error.retryable, true);
    });

    test('swallows a malformed JSON line and keeps parsing valid ones after it', () async {
      final events = await parseChatEventStream(_fixtureStream('sse_malformed_line.txt')).toList();

      expect(events, [
        isA<PersonaTextMessageChunkEvent>().having((e) => e.delta, 'delta', 'before '),
        isA<PersonaTextMessageChunkEvent>().having((e) => e.delta, 'delta', 'after'),
      ]);
    });

    test('an unrecognized top-level event type decodes as PersonaUnknownEvent', () async {
      final events = await parseChatEventStream(
        Stream.value(utf8.encode('data: {"type":"SOME_FUTURE_EVENT","x":1}\ndata: [DONE]\n')),
      ).toList();

      expect(events.single, isA<PersonaUnknownEvent>().having((e) => e.type, 'type', 'SOME_FUTURE_EVENT'));
    });
  });
}
