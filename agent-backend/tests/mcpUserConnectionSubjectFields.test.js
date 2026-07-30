import McpUserConnection from '../src/modules/mcp/mcp-user-connection.model.js';

/**
 * Developer Platform PR-47c (AD-05 §17, blueprint Phase 9): additive-only
 * `domain`/`subjectType`/`externalUserId` fields on the McpUserConnection
 * model, mirroring Thread's PR-22 subject-field treatment exactly. Schema-
 * only assertions — no DB connection needed.
 */
describe('McpUserConnection model — subject fields (subjectType / externalUserId)', () => {
  const minimalPersonaConnection = {
    mcpId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439022',
    accessTokenEncrypted: 'enc:token',
  };

  test('defaults subjectType to "PersonaUser" when not specified', () => {
    const conn = new McpUserConnection(minimalPersonaConnection);
    expect(conn.subjectType).toBe('PersonaUser');
  });

  test('defaults externalUserId to null', () => {
    const conn = new McpUserConnection(minimalPersonaConnection);
    expect(conn.externalUserId).toBeNull();
  });

  test('existing behavior unaffected: userId is still required for a (default) PersonaUser-subject connection', async () => {
    const conn = new McpUserConnection({ ...minimalPersonaConnection, userId: undefined });
    await expect(conn.validate()).rejects.toThrow();
  });

  test('an ExternalUser-subject connection validates with externalUserId and no userId', async () => {
    const conn = new McpUserConnection({
      mcpId: '507f1f77bcf86cd799439011',
      domain: 'project-1',
      subjectType: 'ExternalUser',
      externalUserId: 'sabik',
      accessTokenEncrypted: 'enc:token',
    });
    await expect(conn.validate()).resolves.toBeUndefined();
    expect(conn.userId).toBeUndefined();
  });

  test('an ExternalUser-subject connection without externalUserId fails validation', async () => {
    const conn = new McpUserConnection({
      mcpId: '507f1f77bcf86cd799439011',
      domain: 'project-1',
      subjectType: 'ExternalUser',
      accessTokenEncrypted: 'enc:token',
    });
    await expect(conn.validate()).rejects.toThrow();
  });
});
