import Mcp from '../src/modules/mcp/mcp.model.js';

/**
 * Developer Platform PR-11 (AD-03, AD-04 §18, blueprint Phase 4):
 * additive-only `domain`/`ownerType` fields on the Mcp model, mirroring
 * PR-8's Agent treatment. Schema-only assertions — no DB connection needed.
 */
describe('Mcp model — domain/ownerType fields', () => {
  const minimalValidMcp = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'Test MCP',
    transport: 'http',
    url: 'https://example.com/mcp',
  };

  test('defaults domain to "persona" when not specified', () => {
    const mcp = new Mcp(minimalValidMcp);
    expect(mcp.domain).toBe('persona');
  });

  test('defaults ownerType to "PersonaUser" when not specified', () => {
    const mcp = new Mcp(minimalValidMcp);
    expect(mcp.ownerType).toBe('PersonaUser');
  });

  test('accepts explicit domain and ownerType values, for future Project/ExternalUser-owned MCP definitions', () => {
    const mcp = new Mcp({
      ...minimalValidMcp,
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    expect(mcp.domain).toBe('507f1f77bcf86cd799439099');
    expect(mcp.ownerType).toBe('ExternalUser');
  });

  test('rejects an ownerType outside the supported enum', async () => {
    const mcp = new Mcp({ ...minimalValidMcp, ownerType: 'NotARealOwnerType' });
    await expect(mcp.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default fields) passes validation', async () => {
    const mcp = new Mcp(minimalValidMcp);
    await expect(mcp.validate()).resolves.toBeUndefined();
  });
});
