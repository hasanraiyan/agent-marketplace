import AuditLog from '../src/modules/audit/auditLog.model.js';

/**
 * Developer Platform (blueprint Phase 10, PR-51, AD-08 §35): schema-only
 * assertions for the new AuditLog model — no DB connection needed.
 */
describe('AuditLog model', () => {
  const minimalValid = {
    eventType: 'project.suspended',
    actorContextType: 'ProjectAdmin',
    actorIdentity: 'user_1',
    targetDomain: 'project_1',
  };

  test('a fully valid document passes validation', async () => {
    const log = new AuditLog(minimalValid);
    await expect(log.validate()).resolves.toBeUndefined();
  });

  test('eventType is required', async () => {
    const log = new AuditLog({ ...minimalValid, eventType: undefined });
    await expect(log.validate()).rejects.toThrow();
  });

  test('actorContextType is required', async () => {
    const log = new AuditLog({ ...minimalValid, actorContextType: undefined });
    await expect(log.validate()).rejects.toThrow();
  });

  test('actorIdentity is required', async () => {
    const log = new AuditLog({ ...minimalValid, actorIdentity: undefined });
    await expect(log.validate()).rejects.toThrow();
  });

  test('targetDomain is required', async () => {
    const log = new AuditLog({ ...minimalValid, targetDomain: undefined });
    await expect(log.validate()).rejects.toThrow();
  });

  test('targetResourceId and metadata default to null/{}', () => {
    const log = new AuditLog(minimalValid);
    expect(log.targetResourceId).toBeNull();
    expect(log.metadata).toEqual({});
  });

  test('timestamp defaults to now', () => {
    const before = Date.now();
    const log = new AuditLog(minimalValid);
    expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  test('actorContextType accepts any string — not a strict enum, so a future context type is never rejected', async () => {
    const log = new AuditLog({ ...minimalValid, actorContextType: 'SomeFutureContextType' });
    await expect(log.validate()).resolves.toBeUndefined();
  });
});
