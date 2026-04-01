import { jest } from '@jest/globals';

describe('encryption util disabled', () => {
  it('is a no-op when no encryption keys are configured', async () => {
    jest.resetModules();
    const origKeys = process.env.DB_ENCRYPTION_KEYS;
    const origActiveKeyId = process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;

    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;

    jest.unstable_mockModule('../src/config/index.js', () => ({
      default: {
        port: 3000,
        env: 'test',
        dbEncryptionKeys: null,
        dbEncryptionActiveKeyId: null,
        jwt: {},
        resend: {},
      },
    }));

    const { isEnabled, encrypt, decrypt, needsReencryption } =
      await import('../src/utils/encryption.js');
    expect(isEnabled()).toBe(false);
    const plain = 'plain-text';
    expect(encrypt(plain)).toBe(plain);
    expect(decrypt('whatever')).toBe('whatever');
    expect(needsReencryption('whatever')).toBe(false);

    if (origKeys !== undefined) process.env.DB_ENCRYPTION_KEYS = origKeys;
    if (origActiveKeyId !== undefined) {
      process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = origActiveKeyId;
    }
  });
});
