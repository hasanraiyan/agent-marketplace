import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:test/test.dart';

void main() {
  group('normalizeWorkspaceFiles', () {
    test('converts snake_case wire fields to camelCase', () {
      final result = normalizeWorkspaceFiles({
        '/a.md': {
          'content': 'hello',
          'size': 5,
          'created_at': '2026-01-01T00:00:00Z',
          'modified_at': '2026-01-02T00:00:00Z',
        },
      });

      expect(result['/a.md'], isNotNull);
      expect(result['/a.md']!.content, 'hello');
      expect(result['/a.md']!.size, 5);
      expect(result['/a.md']!.createdAt, '2026-01-01T00:00:00Z');
      expect(result['/a.md']!.modifiedAt, '2026-01-02T00:00:00Z');
    });

    test('skips non-map entries and returns an empty map for empty input', () {
      expect(normalizeWorkspaceFiles({'/bad': 'not a map'}), isEmpty);
      expect(normalizeWorkspaceFiles({}), isEmpty);
    });
  });

  group('normalizePendingInterrupt', () {
    test('flattens a hitl envelope', () {
      final interrupt = normalizePendingInterrupt({
        'kind': 'hitl',
        'value': {
          'actionRequests': [
            {'name': 'delete_file', 'args': null},
          ],
          'reviewConfigs': [],
        },
      });

      expect(interrupt, isA<PersonaHitlInterrupt>());
      expect((interrupt as PersonaHitlInterrupt).actionRequests.single.name, 'delete_file');
    });

    test('flattens a clarification envelope', () {
      final interrupt = normalizePendingInterrupt({
        'kind': 'clarification',
        'value': {
          'questions': [
            {'id': 'q1', 'text': 'Which?', 'options': [], 'required': true, 'allowCustom': false},
          ],
        },
      });

      expect(interrupt, isA<PersonaClarificationInterrupt>());
    });

    test('returns null for null, non-map, or unrecognized-kind input', () {
      expect(normalizePendingInterrupt(null), isNull);
      expect(normalizePendingInterrupt('not a map'), isNull);
      expect(normalizePendingInterrupt({'kind': 'unknown', 'value': <String, dynamic>{}}), isNull);
      expect(normalizePendingInterrupt({'kind': 'hitl'}), isNull); // missing value
    });
  });

  group('persistedTraceToActivityEntries', () {
    test('re-expands a folded text item into a single kind:text entry', () {
      final entries = persistedTraceToActivityEntries([
        {'type': 'text', 'text': 'thinking...'},
      ]);

      expect(entries, [
        PersonaSubagentActivityEntry(kind: PersonaSubagentActivityKind.text, delta: 'thinking...'),
      ]);
    });

    test('re-expands a completed folded tool item into start+result entries', () {
      final entries = persistedTraceToActivityEntries([
        {
          'type': 'tool',
          'name': 'search_web',
          'argsText': '{"q":1}',
          'resultText': 'ok',
          'status': 'completed',
        },
      ]);

      expect(entries, hasLength(2));
      expect(entries[0].kind, PersonaSubagentActivityKind.toolStart);
      expect(entries[0].args, '{"q":1}');
      expect(entries[1].kind, PersonaSubagentActivityKind.toolResult);
      expect(entries[1].result, 'ok');
    });

    test('a running (not completed) folded tool item yields only a start entry', () {
      final entries = persistedTraceToActivityEntries([
        {'type': 'tool', 'name': 'search_web', 'argsText': '{}', 'resultText': '', 'status': 'running'},
      ]);

      expect(entries, hasLength(1));
      expect(entries.single.kind, PersonaSubagentActivityKind.toolStart);
    });

    test('an empty folded text item is dropped, not emitted as an empty delta', () {
      expect(persistedTraceToActivityEntries([{'type': 'text', 'text': ''}]), isEmpty);
    });
  });

  group('isErrorToolContent', () {
    test('true for a JSON object with status:error', () {
      expect(isErrorToolContent('{"status":"error","message":"boom"}'), isTrue);
    });

    test('false for a JSON object with a different status', () {
      expect(isErrorToolContent('{"status":"success"}'), isFalse);
    });

    test('false for non-JSON content and malformed JSON', () {
      expect(isErrorToolContent('plain text result'), isFalse);
      expect(isErrorToolContent('{not valid json'), isFalse);
    });
  });

  group('parsePresentedFile', () {
    test('parses a success envelope, defaulting title to filePath when absent', () {
      final result = parsePresentedFile('{"status":"success","filePath":"/a.md"}');

      expect(result, isNotNull);
      expect(result!.path, '/a.md');
      expect(result.title, '/a.md');
      expect(result.description, '');
    });

    test('uses the provided title/description when present', () {
      final result = parsePresentedFile(
        '{"status":"success","filePath":"/a.md","title":"Report","description":"A report"}',
      );

      expect(result!.title, 'Report');
      expect(result.description, 'A report');
    });

    test('returns null for a non-success status or malformed JSON', () {
      expect(parsePresentedFile('{"status":"error"}'), isNull);
      expect(parsePresentedFile('not json'), isNull);
      expect(parsePresentedFile('{"status":"success"}'), isNull); // missing filePath
    });
  });

  group('extractListEnvelope', () {
    test('unwraps {data:{items:[...]}}', () {
      expect(
        extractListEnvelope({
          'data': {
            'items': [1, 2],
          },
        }),
        [1, 2],
      );
    });

    test('unwraps {items:[...]}', () {
      expect(
        extractListEnvelope({
          'items': [1, 2],
        }),
        [1, 2],
      );
    });

    test('unwraps {data:[...]}', () {
      expect(
        extractListEnvelope({
          'data': [1, 2],
        }),
        [1, 2],
      );
    });

    test('accepts a bare list', () {
      expect(extractListEnvelope([1, 2]), [1, 2]);
    });

    test('returns an empty list for null or an unrecognized shape', () {
      expect(extractListEnvelope(null), isEmpty);
      expect(extractListEnvelope({'unexpected': true}), isEmpty);
    });
  });
}
