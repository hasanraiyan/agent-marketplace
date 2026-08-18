import 'package:persona_agent_client/persona_agent_client.dart';
import 'package:test/test.dart';

import 'helpers/fake_dio.dart';

void main() {
  group('PersonaThreadsController', () {
    test('refetch unwraps {data:{items:[...]}} into PersonaThread models', () async {
      final dio = buildFakeDio({
        'GET /threads': FakeResponse(
          body: {
            'data': {
              'items': [
                {
                  '_id': 't1',
                  'agentId': 'agent-1',
                  'title': 'First thread',
                  'createdAt': '2026-01-01T00:00:00Z',
                  'updatedAt': '2026-01-01T00:00:00Z',
                },
              ],
              'pagination': {'total': 1},
            },
          },
        ),
      });
      final controller = PersonaThreadsController(
        config: PersonaConfig(baseUrl: 'https://example.test'),
        autoFetch: false,
        dio: dio,
      );

      await controller.refetch();

      expect(controller.state.threads, hasLength(1));
      expect(controller.state.threads.single.id, 't1');
      expect(controller.state.threads.single.agentId.id, 'agent-1');
      expect(controller.state.isLoading, isFalse);
    });

    test('refetch handles a bare array response too', () async {
      final dio = buildFakeDio({
        'GET /threads': FakeResponse(
          body: [
            {
              '_id': 't1',
              'agentId': {'_id': 'agent-1', 'name': 'Helper'},
              'createdAt': '2026-01-01T00:00:00Z',
              'updatedAt': '2026-01-01T00:00:00Z',
            },
          ],
        ),
      });
      final controller = PersonaThreadsController(
        config: PersonaConfig(baseUrl: 'https://example.test'),
        autoFetch: false,
        dio: dio,
      );

      await controller.refetch();

      expect(controller.state.threads.single.agentId, isA<PersonaAgentRefSummary>());
      expect((controller.state.threads.single.agentId as PersonaAgentRefSummary).name, 'Helper');
    });

    test('deleteThread removes the thread from local state', () async {
      final dio = buildFakeDio({
        'GET /threads': FakeResponse(
          body: {
            'items': [
              {
                '_id': 't1',
                'agentId': 'agent-1',
                'createdAt': '2026-01-01T00:00:00Z',
                'updatedAt': '2026-01-01T00:00:00Z',
              },
            ],
          },
        ),
        'DELETE /threads/t1': const FakeResponse(),
      });
      final controller = PersonaThreadsController(
        config: PersonaConfig(baseUrl: 'https://example.test'),
        autoFetch: false,
        dio: dio,
      );
      await controller.refetch();

      await controller.deleteThread('t1');

      expect(controller.state.threads, isEmpty);
    });

    test('refetch sets state.error on a failed request', () async {
      final dio = buildFakeDio({});
      final controller = PersonaThreadsController(
        config: PersonaConfig(baseUrl: 'https://example.test'),
        autoFetch: false,
        dio: dio,
      );

      await controller.refetch();

      expect(controller.state.error, isNotNull);
      expect(controller.state.isLoading, isFalse);
    });
  });
}
