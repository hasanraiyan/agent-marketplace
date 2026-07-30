import Mcp from '../src/modules/mcp/mcp.model.js';

/**
 * Developer Platform PR-33 (AD-04, blueprint Phase 9): generalizes Mcp
 * ownership so a Project or ExternalUser can own an MCP definition,
 * mirroring Agent's PR-24 / Skill's PR-27 / KnowledgeBase's PR-30
 * treatment exactly. Schema-only assertions — no DB connection needed.
 */
describe('Mcp model — ownership generalization (ownerId / externalOwnerId)', () => {
  const minimalPersonaMcp = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'Test MCP',
    transport: 'http',
    url: 'https://example.com/mcp',
  };

  test('defaults externalOwnerId to null', () => {
    const mcp = new Mcp(minimalPersonaMcp);
    expect(mcp.externalOwnerId).toBeNull();
  });

  test('existing behavior unaffected: ownerId is still required for a (default) PersonaUser-owned Mcp', async () => {
    const mcp = new Mcp({ ...minimalPersonaMcp, ownerId: undefined });
    await expect(mcp.validate()).rejects.toThrow();
  });

  test('a Project-owned Mcp validates with neither ownerId nor externalOwnerId', async () => {
    const mcp = new Mcp({
      name: 'Support MCP',
      transport: 'http',
      url: 'https://example.com/mcp',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    await expect(mcp.validate()).resolves.toBeUndefined();
    expect(mcp.ownerId).toBeUndefined();
    expect(mcp.externalOwnerId).toBeNull();
  });

  test('an ExternalUser-owned Mcp validates with externalOwnerId and no ownerId', async () => {
    const mcp = new Mcp({
      name: 'Sabik MCP',
      transport: 'http',
      url: 'https://example.com/mcp',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
    await expect(mcp.validate()).resolves.toBeUndefined();
    expect(mcp.ownerId).toBeUndefined();
  });

  test('an ExternalUser-owned Mcp without externalOwnerId fails validation', async () => {
    const mcp = new Mcp({
      name: 'Sabik MCP',
      transport: 'http',
      url: 'https://example.com/mcp',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    await expect(mcp.validate()).rejects.toThrow();
  });
});
