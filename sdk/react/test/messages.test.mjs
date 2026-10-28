import assert from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, it } from 'vitest';

const { PersonaProvider, useMessages, VERSION } = await import('../dist/index.js');

const delivery = {
  channel: 'sms',
  to: '+15550001111',
  from: '+15550002222',
  messageSids: ['SM1'],
  status: 'queued',
  parts: 1,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Renders the hook once and hands back its live return value — useMessages
// has no effects of its own, so a one-shot server render is enough.
function renderHook() {
  let captured;
  function Probe() {
    captured = useMessages();
    return null;
  }
  renderToStaticMarkup(
    createElement(PersonaProvider, { baseUrl: 'https://app.example.com/api/persona' }, createElement(Probe)),
  );
  return captured;
}

describe('useMessages', () => {
  const realFetch = globalThis.fetch;
  let calls;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ success: true, data: delivery });
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('exports useMessages and a semver VERSION string', () => {
    assert.equal(typeof useMessages, 'function');
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('send() POSTs to /messages and unwraps the data envelope', async () => {
    const messages = renderHook();

    const result = await messages.send({ to: '+15550001111', body: 'Your order shipped!' });

    assert.deepEqual(result, delivery);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://app.example.com/api/persona/messages');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      to: '+15550001111',
      body: 'Your order shipped!',
    });
  });

  it('sendFromAgent() POSTs to /messages/agent', async () => {
    const messages = renderHook();

    await messages.sendFromAgent({
      agentId: 'a1',
      to: '+15550001111',
      prompt: 'Send the reminder.',
    });

    assert.equal(calls[0].url, 'https://app.example.com/api/persona/messages/agent');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      agentId: 'a1',
      to: '+15550001111',
      prompt: 'Send the reminder.',
    });
  });

  it('surfaces the runtime error message and rethrows', async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        { error: { code: 'INVALID_REQUEST', message: '"to" is required.' } },
        400,
      );
    const messages = renderHook();

    await assert.rejects(messages.send({ to: '+15550001111' }), /"to" is required\./);
  });
});
