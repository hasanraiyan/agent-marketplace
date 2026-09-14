import assert from 'node:assert';
import { describe, it } from 'vitest';

const { useArchitectChat, ARCHITECT_AGENT_ID } = await import('../dist/index.js');

describe('Architect exports', () => {
  it('exports useArchitectChat and the Architect sentinel id', () => {
    assert.equal(typeof useArchitectChat, 'function');
    assert.equal(ARCHITECT_AGENT_ID, '000000000000000000000002');
  });
});
