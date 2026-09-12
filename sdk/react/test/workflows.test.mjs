import assert from 'node:assert';
import { describe, it } from 'vitest';

class MockXHR {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.headers = {};
    this.sentBody = undefined;
    this.method = '';
    this.url = '';
    this.aborted = false;
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key, value) {
    this.headers[key] = value;
  }
  getResponseHeader(name) {
    return this.headers[name] ?? null;
  }
  send(body) {
    this.sentBody = body;
    MockXHR.last = this;
  }
  abort() {
    this.aborted = true;
  }
  emitHeaders(status, responseHeaders = {}) {
    this.status = status;
    this.headers = { ...this.headers, ...responseHeaders };
    this.readyState = 2;
    this.onreadystatechange?.();
  }
  emitChunk(text) {
    this.responseText += text;
    this.readyState = 3;
    this.onreadystatechange?.();
  }
  end() {
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

globalThis.XMLHttpRequest = MockXHR;
Object.defineProperty(globalThis, 'navigator', { value: { product: 'ReactNative' }, configurable: true });

const {
  openSSEStream,
  useWorkflows,
  useWorkflow,
  useWorkflowStream,
  useWorkflowRuns,
  VERSION,
} = await import('../dist/index.js');

describe('Workflows exports & streaming', () => {
  it('exports all workflow hooks and version 0.9.0', () => {
    assert.equal(typeof useWorkflows, 'function');
    assert.equal(typeof useWorkflow, 'function');
    assert.equal(typeof useWorkflowStream, 'function');
    assert.equal(typeof useWorkflowRuns, 'function');
    assert.equal(VERSION, '0.9.0');
  });

  it('supports GET method in openSSEStream for stream resumption', async () => {
    const p = openSSEStream({
      url: 'http://localhost/api/persona/workflows/runs/run_123/resume?since=4',
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });

    const xhr = MockXHR.last;
    assert.equal(xhr.method, 'GET');
    assert.equal(xhr.sentBody, null, 'GET must send null body');
    assert.equal(xhr.url, 'http://localhost/api/persona/workflows/runs/run_123/resume?since=4');

    xhr.emitHeaders(200, { 'x-persona-run-id': 'run_123' });
    const stream = await p;
    assert.equal(stream.ok, true);
    assert.equal(stream.getHeader('x-persona-run-id'), 'run_123');

    // Emit workflow events
    xhr.emitChunk('data: {"type":"CUSTOM","name":"workflow_node_started","value":{"nodeId":"node_1","nodeType":"agent","nodeLabel":"Agent Step"}}\n\n');
    xhr.emitChunk('data: {"type":"TEXT_MESSAGE_CHUNK","delta":"Working..."}\n\n');
    xhr.emitChunk('data: {"type":"CUSTOM","name":"workflow_node_completed","value":{"nodeId":"node_1","output":{"success":true}}}\n\n');
    xhr.emitChunk('data: {"type":"RUN_FINISHED"}\n\n');
    xhr.end();

    const chunk1 = await stream.reader.read();
    assert.ok(chunk1.value.includes('workflow_node_started'));

    const chunk2 = await stream.reader.read();
    assert.ok(chunk2.value.includes('Working...'));

    const chunk3 = await stream.reader.read();
    assert.ok(chunk3.value.includes('workflow_node_completed'));

    const chunk4 = await stream.reader.read();
    assert.ok(chunk4.value.includes('RUN_FINISHED'));

    const finalRead = await stream.reader.read();
    assert.equal(finalRead.done, true);
  });

  it('supports POST method with body in openSSEStream for workflow stream trigger', async () => {
    const payload = JSON.stringify({ input: { text: 'start' }, dryRun: true });
    const p = openSSEStream({
      url: 'http://localhost/api/persona/workflows/wf_abc/stream',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    const xhr = MockXHR.last;
    assert.equal(xhr.method, 'POST');
    assert.equal(xhr.sentBody, payload);

    xhr.emitHeaders(200, { 'x-persona-run-id': 'run_dry_999' });
    const stream = await p;
    assert.equal(stream.ok, true);
    assert.equal(stream.getHeader('x-persona-run-id'), 'run_dry_999');

    xhr.emitChunk('data: {"type":"RUN_STARTED","runId":"run_dry_999"}\n\n');
    xhr.end();

    const chunk = await stream.reader.read();
    assert.ok(chunk.value.includes('run_dry_999'));

    const done = await stream.reader.read();
    assert.equal(done.done, true);
  });
});
