import { describe, expect, it } from 'vitest';
import { TranslationError, toRuntimeRequest } from '../src/translate.js';
import { jsonRequest, routeContext } from './helpers.js';

describe('toRuntimeRequest — path resolution', () => {
  it('builds a mount-relative path from the catch-all segments (Next 15 promise params)', async () => {
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/threads/t_1/messages'),
      routeContext(['threads', 't_1', 'messages'])
    );
    expect(request.path).toBe('/threads/t_1/messages');
  });

  it('accepts the Next 14 plain-object params shape', async () => {
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/threads'),
      routeContext(['threads'], false)
    );
    expect(request.path).toBe('/threads');
  });

  it('re-encodes catch-all segments, which Next hands over already decoded', async () => {
    // The runtime decodes `:param` captures itself — a segment containing a
    // literal '%' or '/' must survive that second decode intact.
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/knowledge/k_1/documents/50%25%20draft.pdf'),
      routeContext(['knowledge', 'k_1', 'documents', '50% draft.pdf'])
    );
    expect(request.path).toBe('/knowledge/k_1/documents/50%25%20draft.pdf');
    expect(decodeURIComponent('50%25%20draft.pdf')).toBe('50% draft.pdf');
  });

  it('falls back to the full pathname when the route is not a catch-all', async () => {
    // The runtime strips `mountPath` itself, so the full path is still valid.
    const request = await toRuntimeRequest(new Request('http://app.test/api/persona/health'));
    expect(request.path).toBe('/api/persona/health');
  });

  it('ignores non-array params (a [id] dynamic segment) and uses the pathname', async () => {
    const request = await toRuntimeRequest(new Request('http://app.test/api/persona/health'), {
      params: Promise.resolve({ id: 'abc' }),
    });
    expect(request.path).toBe('/api/persona/health');
  });
});

describe('toRuntimeRequest — headers, query, method', () => {
  it('lowercases header names and collects the query string', async () => {
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/threads?limit=20&cursor=abc', {
        headers: { 'X-Trace-Id': 't-1', Authorization: 'Bearer session' },
      }),
      routeContext(['threads'])
    );
    expect(request.method).toBe('GET');
    expect(request.headers['x-trace-id']).toBe('t-1');
    expect(request.headers['authorization']).toBe('Bearer session');
    expect(request.query).toEqual({ limit: '20', cursor: 'abc' });
  });

  it('always starts with userId null — the runtime fills it in', async () => {
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/threads'),
      routeContext(['threads'])
    );
    expect(request.userId).toBeNull();
  });
});

describe('toRuntimeRequest — body', () => {
  it('parses a JSON body', async () => {
    const request = await toRuntimeRequest(
      jsonRequest('http://app.test/api/persona/chat', 'POST', { agentId: 'a_1', messages: [] }),
      routeContext(['chat'])
    );
    expect(request.body).toEqual({ agentId: 'a_1', messages: [] });
  });

  it('leaves the body undefined for GET and DELETE', async () => {
    for (const method of ['GET', 'DELETE'] as const) {
      const request = await toRuntimeRequest(
        new Request('http://app.test/api/persona/threads/t_1', { method }),
        routeContext(['threads', 't_1'])
      );
      expect(request.body).toBeUndefined();
    }
  });

  it('leaves the body undefined for an empty POST body', async () => {
    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/threads', { method: 'POST' }),
      routeContext(['threads'])
    );
    expect(request.body).toBeUndefined();
  });

  it('throws a TranslationError on malformed JSON', async () => {
    const req = new Request('http://app.test/api/persona/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    await expect(toRuntimeRequest(req, routeContext(['chat']))).rejects.toBeInstanceOf(
      TranslationError
    );
  });
});

describe('toRuntimeRequest — multipart', () => {
  it('maps a `file` field to request.file and other fields to the body', async () => {
    const form = new FormData();
    form.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    form.set('agentId', 'a_1');
    form.set('threadId', 't_1');

    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/files', { method: 'POST', body: form }),
      routeContext(['files'])
    );

    expect(request.file?.filename).toBe('notes.txt');
    expect(request.file?.contentType).toBe('text/plain');
    expect(new TextDecoder().decode(request.file?.content)).toBe('hello');
    expect(request.files).toBeUndefined();
    expect(request.body).toEqual({ agentId: 'a_1', threadId: 't_1' });
  });

  it('collects repeated `files` fields into request.files', async () => {
    const form = new FormData();
    form.append('files', new File(['one'], 'a.txt', { type: 'text/plain' }));
    form.append('files', new File(['two'], 'b.txt', { type: 'text/plain' }));

    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/knowledge/k_1/documents', {
        method: 'POST',
        body: form,
      }),
      routeContext(['knowledge', 'k_1', 'documents'])
    );

    expect(request.files?.map((f) => f.filename)).toEqual(['a.txt', 'b.txt']);
    expect(request.file).toBeUndefined();
  });

  it('does not let a `__proto__` form field pollute the body object', async () => {
    const form = new FormData();
    form.set('__proto__', 'polluted');
    form.set('agentId', 'a_1');

    const request = await toRuntimeRequest(
      new Request('http://app.test/api/persona/files', { method: 'POST', body: form }),
      routeContext(['files'])
    );

    expect(Object.getPrototypeOf(request.body)).toBeNull();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect((request.body as Record<string, unknown>)['agentId']).toBe('a_1');
  });
});
