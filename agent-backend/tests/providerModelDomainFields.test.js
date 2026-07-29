import Provider from '../src/modules/providers/provider.model.js';

/**
 * Developer Platform PR-11 (AD-03, AD-04 §18 / AD-06 §21, blueprint
 * Phase 4): additive-only `domain`/`ownerType` fields on the Provider
 * model, mirroring PR-8's Agent treatment. Provider ownership is
 * narrower than most resources — `ownerType` only supports
 * `['PersonaUser', 'Project']`; `ExternalUser` is deliberately excluded
 * (AD-06 §21: "not decided" whether it applies). Schema-only assertions
 * — no DB connection needed.
 */
describe('Provider model — domain/ownerType fields', () => {
  const minimalValidProvider = {
    ownerId: '507f1f77bcf86cd799439011',
    label: 'Test Provider',
    baseURL: 'https://api.example.com',
    apiKeyEncrypted: 'encrypted-value',
    defaultModel: 'gpt-4o',
  };

  test('defaults domain to "persona" when not specified', () => {
    const provider = new Provider(minimalValidProvider);
    expect(provider.domain).toBe('persona');
  });

  test('defaults ownerType to "PersonaUser" when not specified', () => {
    const provider = new Provider(minimalValidProvider);
    expect(provider.ownerType).toBe('PersonaUser');
  });

  test('accepts an explicit domain and ownerType of "Project", for future Project-owned Providers', () => {
    const provider = new Provider({
      ...minimalValidProvider,
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    expect(provider.domain).toBe('507f1f77bcf86cd799439099');
    expect(provider.ownerType).toBe('Project');
  });

  test('rejects "ExternalUser" — Provider ownership is deliberately narrower than other resources (AD-06 §21)', async () => {
    const provider = new Provider({ ...minimalValidProvider, ownerType: 'ExternalUser' });
    await expect(provider.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default fields) passes validation', async () => {
    const provider = new Provider(minimalValidProvider);
    await expect(provider.validate()).resolves.toBeUndefined();
  });
});
