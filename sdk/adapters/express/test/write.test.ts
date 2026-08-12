import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { Response } from 'express';
import type { RuntimeResponse } from '@personaai/runtime';
import { writeRuntimeResponse } from '../src/write.js';

/** Minimal mock of Express's Response — just enough surface for writeRuntimeResponse. */
function makeMockRes() {
  const events = new EventEmitter();
  const writes: unknown[] = [];
  return {
    statusCode: 0,
    writes,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    flushHeaders() {},
    write(chunk: unknown) {
      writes.push(chunk);
      return true;
    },
    end(chunk?: unknown) {
      if (chunk !== undefined) writes.push(chunk);
    },
    once: (event: string, fn: () => void) => events.once(event, fn),
    on: (event: string, fn: () => void) => events.on(event, fn),
    off: (event: string, fn: () => void) => events.off(event, fn),
    emit: (event: string) => events.emit(event),
  };
}

describe('writeRuntimeResponse', () => {
  it('calls iterator.return() on the runtime stream when the response closes', async () => {
    let returned = false;
    const response: RuntimeResponse = {
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: (async function* () {
        try {
          yield 'data: {"type":"a"}\n\n';
          while (true) {
            yield ': heartbeat\n\n';
            await new Promise((r) => setTimeout(r, 5));
          }
        } finally {
          returned = true;
        }
      })(),
    };

    const res = makeMockRes();
    const pending = writeRuntimeResponse(res as unknown as Response, response);

    await new Promise((r) => setTimeout(r, 20)); // let the first frames flow
    res.emit('close');
    await pending;

    expect(res.writes[0]).toBe('data: {"type":"a"}\n\n');
    expect(returned).toBe(true);
  });
});
