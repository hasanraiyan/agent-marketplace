import { describe, expect, it } from 'vitest';
import { createPersonaHandler, toNextRouteHandlers } from '../src/server.js';
import { jsonRequest, makeFakeRuntime, okJson, routeContext } from './helpers.js';

describe('toNextRouteHandlers', () => {
  it('exports one handler per method and routes every one through the runtime', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const handlers = toNextRouteHandlers(runtime);

    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const res = await handlers[method](
        jsonRequest(
          'http://app.test/api/persona/threads',
          method,
          method === 'GET' ? undefined : {}
        ),
        routeContext(['threads'])
      );
      expect(res.status).toBe(200);
    }

    expect(runtime.requests.map((r) => r.method)).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
    ]);
  });

  it('exposes the runtime so close() stays reachable', () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    expect(toNextRouteHandlers(runtime).runtime).toBe(runtime);
  });

  it('hands the resolved user id to the runtime', async () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    const handlers = toNextRouteHandlers(runtime, {
      resolveUserFrom: (req) => req.headers.get('x-user') ?? null,
    });

    await handlers.GET(
      new Request('http://app.test/api/persona/threads', { headers: { 'x-user': 'user_42' } }),
      routeContext(['threads'])
    );

    expect(runtime.requests[0]?.userId).toBe('user_42');
  });

  it('treats a throwing resolver as "not authenticated" rather than a 500', async () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    const handlers = toNextRouteHandlers(runtime, {
      resolveUserFrom: () => {
        throw new Error('session lookup exploded');
      },
    });

    const res = await handlers.GET(
      new Request('http://app.test/api/persona/threads'),
      routeContext(['threads'])
    );

    expect(res.status).toBe(200); // the fake runtime doesn't enforce auth …
    expect(runtime.requests[0]?.userId).toBeNull(); // … but it was told there is no user
  });

  it('answers a malformed JSON body with a 400, without calling the runtime', async () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    const handlers = toNextRouteHandlers(runtime);

    const res = await handlers.POST(
      new Request('http://app.test/api/persona/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
      routeContext(['chat'])
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body is not valid JSON.' },
    });
    expect(runtime.requests).toHaveLength(0);
  });

  it('works without the Next route context at all (a non-catch-all mount)', async () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    const handlers = toNextRouteHandlers(runtime);
    await handlers.GET(new Request('http://app.test/api/persona/health'));
    expect(runtime.requests[0]?.path).toBe('/api/persona/health');
  });
});

describe('createPersonaHandler', () => {
  const base = {
    baseUrl: 'https://api.persona.test',
    credential: 'key_test.secret',
  };

  it('requires a user resolver', () => {
    expect(() => createPersonaHandler({ ...base })).toThrow(
      /either "resolveUser" or "resolveUserFrom" is required/
    );
  });

  it('builds a real runtime and serves its routes', async () => {
    const handlers = createPersonaHandler({
      ...base,
      mountPath: '/api/persona',
      resolveUserFrom: () => 'user_1',
      // /health probes the Persona API via whoami() — stub that hop.
      fetch: (async () =>
        Response.json({ projectId: 'p_1', domain: 'test' })) as unknown as typeof fetch,
    });

    const res = await handlers.GET(
      new Request('http://app.test/api/persona/health'),
      routeContext(['health'])
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
    handlers.runtime.close();
  });

  it('401s when the resolver returns null', async () => {
    const handlers = createPersonaHandler({ ...base, resolveUserFrom: () => null });

    const res = await handlers.GET(
      new Request('http://app.test/api/persona/threads'),
      routeContext(['threads'])
    );

    expect(res.status).toBe(401);
    handlers.runtime.close();
  });

  it('404s an unknown route through the runtime, not the adapter', async () => {
    const handlers = createPersonaHandler({ ...base, resolveUserFrom: () => 'user_1' });

    const res = await handlers.GET(
      new Request('http://app.test/api/persona/nope'),
      routeContext(['nope'])
    );

    expect(res.status).toBe(404);
    handlers.runtime.close();
  });

  it('streams a chat run end to end over a stubbed upstream', async () => {
    const upstream = [
      'data: {"type":"RUN_STARTED"}\n\n',
      'data: {"type":"TEXT_MESSAGE_CHUNK","delta":"hi"}\n\n',
      'data: {"type":"RUN_FINISHED"}\n\n',
    ];

    const handlers = createPersonaHandler({
      ...base,
      resolveUserFrom: () => 'user_1',
      // Stand in for the Persona API: reply with the AG-UI frames the runtime
      // would otherwise fetch over the network.
      fetch: (async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const encoder = new TextEncoder();
              for (const frame of upstream) controller.enqueue(encoder.encode(frame));
              controller.close();
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } }
        )) as typeof fetch,
    });

    const res = await handlers.POST(
      jsonRequest('http://app.test/api/persona/chat', 'POST', { agentId: 'a_1', messages: [] }),
      routeContext(['chat'])
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('x-persona-run-id')).toBeTruthy();

    const text = await res.text();
    for (const frame of upstream) expect(text).toContain(frame.trim());

    handlers.runtime.close();
  });
});
