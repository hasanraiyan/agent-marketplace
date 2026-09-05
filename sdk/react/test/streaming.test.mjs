// Verifies the React Native (XHR) branch of openSSEStream: chunks arrive in
// order whether the consumer is ahead of or behind the socket, the stream
// terminates, and a non-2xx status is reported without waiting for the body.
import assert from 'node:assert';
import { describe, it } from 'vitest';

// Must be set before '../dist/index.js' is evaluated so the module picks the
// React Native (XHR) transport, hence the dynamic import below.
Object.defineProperty(globalThis, 'navigator', { value: { product: 'ReactNative' }, configurable: true });

class FakeXHR {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.headers = {};
    this.aborted = false;
  }
  open() {}
  setRequestHeader() {}
  getResponseHeader(n) {
    return this.headers[n] ?? null;
  }
  send() {
    FakeXHR.last = this;
  }
  abort() {
    this.aborted = true;
  }
  // test helpers
  emitHeaders(status) {
    this.status = status;
    this.readyState = 2;
    this.onreadystatechange();
  }
  emitChunk(text) {
    this.responseText += text;
    this.readyState = 3;
    this.onreadystatechange();
  }
  end() {
    this.readyState = 4;
    this.onreadystatechange();
  }
}
globalThis.XMLHttpRequest = FakeXHR;

const { openSSEStream, supportsStreamingFetch } = await import('../dist/index.js');

describe('openSSEStream (React Native XHR transport)', () => {
  it('reports RN as not supporting streaming fetch', () => {
    assert.equal(supportsStreamingFetch(), false, 'RN must not report streaming fetch support');
  });

  it('delivers queued chunks in order, then terminates (consumer behind the socket)', async () => {
    const p = openSSEStream({ url: 'http://x/chat', headers: {}, body: '{}' });
    const xhr = FakeXHR.last;
    xhr.emitHeaders(200);
    const stream = await p;
    assert.equal(stream.ok, true);

    xhr.emitChunk('data: {"a":1}\n\n');
    xhr.emitChunk('data: {"b":2}\n\n');
    xhr.end();

    const a = await stream.reader.read();
    const b = await stream.reader.read();
    const c = await stream.reader.read();
    assert.equal(a.value, 'data: {"a":1}\n\n');
    assert.equal(b.value, 'data: {"b":2}\n\n');
    assert.equal(c.done, true, 'stream must terminate');
  });

  it('pends a read until a chunk lands, then resolves (consumer ahead of the socket)', async () => {
    const p = openSSEStream({ url: 'http://x/chat', headers: {}, body: '{}' });
    const xhr = FakeXHR.last;
    xhr.emitHeaders(200);
    const stream = await p;

    const pending = stream.reader.read();
    let settled = false;
    void pending.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(settled, false, 'read must pend until a chunk arrives');

    xhr.emitChunk('data: hello\n\n');
    const first = await pending;
    assert.equal(first.value, 'data: hello\n\n');

    xhr.end();
    assert.equal((await stream.reader.read()).done, true);
  });

  it('surfaces a non-2xx status from headers without waiting for the body', async () => {
    const p = openSSEStream({ url: 'http://x/chat', headers: {}, body: '{}' });
    const xhr = FakeXHR.last;
    xhr.emitHeaders(401);
    const stream = await p;
    assert.equal(stream.ok, false);
    assert.equal(stream.status, 401);
  });

  it('cancel aborts the underlying request', async () => {
    const p = openSSEStream({ url: 'http://x/chat', headers: {}, body: '{}' });
    const xhr = FakeXHR.last;
    xhr.emitHeaders(200);
    const stream = await p;
    stream.reader.cancel();
    assert.equal(xhr.aborted, true, 'cancel must abort the XHR');
  });
});
