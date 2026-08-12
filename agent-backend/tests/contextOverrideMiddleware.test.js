import { jest } from '@jest/globals';
import { SystemMessage } from '@langchain/core/messages';
import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';
import { contextOverrideMiddleware } from '../src/modules/agents/agent.factory.js';

/**
 * REQ-2: contextOverride must reach the model for the turn that supplied it
 * and must NOT leak into a later turn against the same (cached) compiled
 * agent graph. wrapModelCall reads getConfig().configurable.contextOverride
 * fresh on every call, so we drive it the same way LangGraph does: via
 * AsyncLocalStorageProviderSingleton.runWithConfig around the call.
 */
describe('contextOverrideMiddleware (REQ-2)', () => {
  function runWithConfigurable(configurable, fn) {
    return AsyncLocalStorageProviderSingleton.runWithConfig({ configurable }, fn);
  }

  test('appends contextOverride to the system message when present', async () => {
    const request = { systemMessage: new SystemMessage('base prompt') };
    const handler = jest.fn(async (req) => req);

    const result = await runWithConfigurable(
      { contextOverride: 'stage=seed, sector=fintech' },
      () => contextOverrideMiddleware.wrapModelCall(request, handler)
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.systemMessage.content).toContain('base prompt');
    expect(result.systemMessage.content).toContain('stage=seed, sector=fintech');
  });

  test('leaves the request untouched when no contextOverride is set', async () => {
    const request = { systemMessage: new SystemMessage('base prompt') };
    const handler = jest.fn(async (req) => req);

    const result = await runWithConfigurable({}, () =>
      contextOverrideMiddleware.wrapModelCall(request, handler)
    );

    expect(handler).toHaveBeenCalledWith(request);
    expect(result.systemMessage).toBe(request.systemMessage);
  });

  test("does not leak a prior turn's contextOverride into a turn that omits it", async () => {
    const request = { systemMessage: new SystemMessage('base prompt') };
    const handler = jest.fn(async (req) => req);

    const firstTurn = await runWithConfigurable({ contextOverride: 'founder is fundraising' }, () =>
      contextOverrideMiddleware.wrapModelCall(request, handler)
    );
    expect(firstTurn.systemMessage.content).toContain('founder is fundraising');

    // Same cached agent, same request object, next turn from the same caller
    // omits contextOverride — the earlier turn's override must not reappear.
    const secondTurn = await runWithConfigurable({}, () =>
      contextOverrideMiddleware.wrapModelCall(request, handler)
    );
    expect(secondTurn.systemMessage.content).not.toContain('founder is fundraising');
    expect(secondTurn.systemMessage.content).toBe('base prompt');
  });
});
