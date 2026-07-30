import DeveloperFile from '../src/modules/files/file.model.js';

/**
 * Developer Platform PR-47d (blueprint Phase 9 §15): schema-only
 * assertions for the new DeveloperFile model — no DB connection needed.
 */
describe('DeveloperFile model', () => {
  const minimalValid = {
    domain: 'project-1',
    externalUserId: 'sabik',
    storageKey: 'uuid-1.txt',
    originalName: 'notes.txt',
    mimeType: 'text/plain',
    size: 42,
  };

  test('a fully valid document passes validation', async () => {
    const file = new DeveloperFile(minimalValid);
    await expect(file.validate()).resolves.toBeUndefined();
  });

  test('domain is required', async () => {
    const file = new DeveloperFile({ ...minimalValid, domain: undefined });
    await expect(file.validate()).rejects.toThrow();
  });

  test('externalUserId is required — there is no Persona/Project-machine form', async () => {
    const file = new DeveloperFile({ ...minimalValid, externalUserId: undefined });
    await expect(file.validate()).rejects.toThrow();
  });

  test('agentId and threadId default to null (optional associations)', () => {
    const file = new DeveloperFile(minimalValid);
    expect(file.agentId).toBeNull();
    expect(file.threadId).toBeNull();
  });
});
