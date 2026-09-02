import { describe, expect, it } from 'vitest';
import { toWebResponse } from '../src/write.js';

describe('toWebResponse — buffered', () => {
  it('passes status, headers and the pre-serialized body through verbatim', async () => {
    const res = toWebResponse({
      kind: 'buffered',
      status: 201,
      headers: { 'content-type': 'application/json', 'x-persona-thread-id': 't_1' },
      body: '{"id":"t_1"}',
    });

    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('x-persona-thread-id')).toBe('t_1');
    expect(await res.text()).toBe('{"id":"t_1"}');
  });

  it('sends no body for a 204 — the Fetch spec rejects one', async () => {
    // The runtime's noContent() helper returns `body: ''`, which would make
    // `new Response('', { status: 204 })` throw.
    const res = toWebResponse({ kind: 'buffered', status: 204, headers: {}, body: '' });
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});

describe('toWebResponse — SSE streaming', () => {
  it('streams frames verbatim, in order, and disables proxy buffering', async () => {
    const res = toWebResponse({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-persona-run-id': 'run-1' },
      body: (async function* () {
        yield 'data: {"type":"RUN_STARTED"}\n\n';
        yield 'data: {"type":"TEXT","delta":"hi"}\n\n';
        yield 'data: {"type":"RUN_FINISHED"}\n\n';
      })(),
    });

    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('x-persona-run-id')).toBe('run-1');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(await res.text()).toBe(
      'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"TEXT","delta":"hi"}\n\ndata: {"type":"RUN_FINISHED"}\n\n'
    );
  });

  it('leaves an x-accel-buffering the runtime already set alone', () => {
    const res = toWebResponse({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-accel-buffering': 'yes' },
      body: (async function* () {})(),
    });
    expect(res.headers.get('x-accel-buffering')).toBe('yes');
  });

  it('tears the runtime stream down when the client cancels mid-stream', async () => {
    let returned = false;
    const res = toWebResponse({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: (async function* () {
        try {
          yield 'data: {"type":"a"}\n\n';
          yield 'data: {"type":"b"}\n\n';
          while (true) yield ': heartbeat\n\n';
        } finally {
          returned = true;
        }
      })(),
    });

    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('data: {"type":"a"}\n\n');

    await reader.cancel();
    expect(returned).toBe(true);
  });

  it('only pulls from the runtime as the consumer reads (backpressure)', async () => {
    let produced = 0;
    const res = toWebResponse({
      kind: 'stream',
      status: 200,
      headers: {},
      body: (async function* () {
        while (true) {
          produced += 1;
          yield `data: ${produced}\n\n`;
        }
      })(),
    });

    const reader = res.body!.getReader();
    await reader.read();
    // A pull-based source may read one chunk ahead to fill the queue; what
    // matters is that it does not run away from the consumer.
    expect(produced).toBeLessThanOrEqual(2);
    await reader.cancel();
  });
});

describe('toWebResponse — binary', () => {
  it('streams raw bytes through unchanged', async () => {
    const res = toWebResponse({
      kind: 'binary',
      status: 200,
      headers: { 'content-type': 'application/pdf' },
      body: (async function* () {
        yield new Uint8Array([1, 2, 3]);
        yield new Uint8Array([4, 5]);
      })(),
    });

    expect(res.headers.get('content-type')).toBe('application/pdf');
    // Binary downloads are not SSE — no proxy-buffering override.
    expect(res.headers.get('x-accel-buffering')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });
});
