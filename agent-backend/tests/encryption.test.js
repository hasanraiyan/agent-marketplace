import { jest } from '@jest/globals';
import crypto from 'crypto';

const ORIGINAL_ENCRYPTION_ENV = {
  DB_ENCRYPTION_KEYS: process.env.DB_ENCRYPTION_KEYS,
  DB_ENCRYPTION_ACTIVE_KEY_ID: process.env.DB_ENCRYPTION_ACTIVE_KEY_ID,
};

function clearEncryptionEnv() {
  delete process.env.DB_ENCRYPTION_KEYS;
  delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
}

function restoreEncryptionEnv() {
  clearEncryptionEnv();

  for (const [name, value] of Object.entries(ORIGINAL_ENCRYPTION_ENV)) {
    if (value !== undefined) {
      process.env[name] = value;
    }
  }
}

describe('encryption util', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    restoreEncryptionEnv();
  });

  it('encrypts and decrypts strings with the active rotating key', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { encrypt, decrypt, isEnabled, needsReencryption } =
      await import('../src/utils/encryption.js');
    expect(isEnabled()).toBe(true);
    const plain = 'hello world';
    const cipher = encrypt(plain);
    expect(cipher).toMatch(/^enc:v1:current:/);
    expect(typeof cipher).toBe('string');
    expect(cipher).not.toBe(plain);
    const dec = decrypt(cipher);
    expect(dec).toBe(plain);
    expect(needsReencryption(cipher)).toBe(false);
  });

  it('preserves string values that look like JSON literals', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');

    expect(decrypt(encrypt('00123'))).toBe('00123');
    expect(decrypt(encrypt('true'))).toBe('true');
    expect(decrypt(encrypt('null'))).toBe('null');
    expect(decrypt(encrypt('"quoted"'))).toBe('"quoted"');
  });

  it('encrypts and decrypts objects with the active rotating key', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const obj = { a: 1, b: 'x' };
    const cipher = encrypt(obj);
    expect(typeof cipher).toBe('string');
    const dec = decrypt(cipher);
    expect(dec).toEqual(obj);
  });

  it('preserves objects that happen to contain the old string marker shape', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');

    const payload = {
      __agentMarketplaceEncryptedString: true,
      value: 'kept as object',
      extra: 'metadata',
    };

    expect(decrypt(encrypt(payload))).toEqual(payload);
  });

  it('throws DecryptionError and logs when decrypt fails with invalid token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { decrypt } = await import('../src/utils/encryption.js');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => decrypt('not-a-valid-token')).toThrow('Decryption failed:');
    expect(spy).toHaveBeenCalled();
  });

  it('logs error without message property and throws DecryptionError', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { default: crypto } = await import('crypto');
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const validToken = encrypt('token to break');
    const createDecipherivSpy = jest.spyOn(crypto, 'createDecipheriv').mockImplementation(() => {
      throw { code: 'CUSTOM_ERROR' }; // no message property
    });
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => decrypt(validToken)).toThrow('Decryption failed: CUSTOM_ERROR');
    expect(spy).toHaveBeenCalledWith('decrypt failed:', 'CUSTOM_ERROR');
    createDecipherivSpy.mockRestore();
  });

  it('encrypts versioned tokens with the active key id', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      old: 'old-passphrase',
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';

    const { encrypt, decrypt, isEnabled, needsReencryption } =
      await import('../src/utils/encryption.js');

    const plain = 'rotating key token';
    const cipher = encrypt(plain);

    expect(isEnabled()).toBe(true);
    expect(cipher).toMatch(/^enc:v1:current:/);
    expect(decrypt(cipher)).toBe(plain);
    expect(needsReencryption(cipher)).toBe(false);
  });

  it('decrypts tokens written with a previous rotating key and flags them for reencryption', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      old: 'old-passphrase',
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'old';

    const { encrypt } = await import('../src/utils/encryption.js');
    const oldToken = encrypt('rotate me');

    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      old: 'old-passphrase',
      current: 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';

    const { decrypt, needsReencryption } = await import('../src/utils/encryption.js');
    expect(decrypt(oldToken)).toBe('rotate me');
    expect(needsReencryption(oldToken)).toBe(true);
  });

  it('rejects key ids that break the token format', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      'bad:key': 'current-passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'bad:key';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'Encryption key ids may only contain letters, numbers, underscores, and hyphens'
    );
  });

  it('throws when secret is empty string', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: '',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'Encryption key "key1" must be a non-empty string'
    );
  });

  it('throws when base64 key decodes to wrong length', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    // base64 string that decodes to 16 bytes (should be 32)
    const shortBase64 = Buffer.from('1234567890123456').toString('base64');
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: `base64:${shortBase64}`,
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'base64 encryption keys must decode to 32 bytes'
    );
  });

  it('encrypts and decrypts with valid base64 key', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    // generate a 32-byte random key and encode as base64
    const keyBytes = crypto.randomBytes(32);
    const base64Key = keyBytes.toString('base64');
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: `base64:${base64Key}`,
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';
    const { encrypt, decrypt, isEnabled } = await import('../src/utils/encryption.js');
    expect(isEnabled()).toBe(true);
    const plain = 'test message';
    const cipher = encrypt(plain);
    expect(cipher).toMatch(/^enc:v1:key1:/);
    const decrypted = decrypt(cipher);
    expect(decrypted).toBe(plain);
  });

  it('decrypt throws DecryptionError for token with empty parts', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { decrypt } = await import('../src/utils/encryption.js');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // token with empty keyId, iv, tag, ciphertext
    const token = 'enc:v1:::::';
    expect(() => decrypt(token)).toThrow('Decryption failed:');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('needsReencryption returns false for non-string token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { needsReencryption } = await import('../src/utils/encryption.js');
    // @ts-expect-error testing invalid input
    expect(needsReencryption(123)).toBe(false);
  });

  it('throws when keyId is empty string', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      '': 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = '';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'Encryption key ids must be non-empty strings'
    );
  });

  it('throws when DB_ENCRYPTION_KEYS is empty object', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = '{}';
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'any';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must contain at least one key'
    );
  });

  it('throws when DB_ENCRYPTION_ACTIVE_KEY_ID missing but keys present', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: 'passphrase',
    });
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;

    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'DB_ENCRYPTION_ACTIVE_KEY_ID is required when DB_ENCRYPTION_KEYS is set'
    );
  });

  it('throws when DB_ENCRYPTION_ACTIVE_KEY_ID not in keyring', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key2';

    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'DB_ENCRYPTION_ACTIVE_KEY_ID must match a key in DB_ENCRYPTION_KEYS'
    );
  });

  it('decrypt throws DecryptionError for token with unknown key id', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const token = encrypt('test');
    // change active key to different, but keep same keys? Actually token contains keyId = key1.
    // Now remove key1 from keyring (by resetting env) and try decrypt
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key2: 'otherphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key2';
    const { decrypt: decrypt2 } = await import('../src/utils/encryption.js');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => decrypt2(token)).toThrow('Decryption failed: Unknown encryption key id: key1');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('needsReencryption returns true for non-versioned token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { needsReencryption } = await import('../src/utils/encryption.js');
    expect(needsReencryption('plain string')).toBe(true);
  });

  it('needsReencryption returns false for malformed versioned token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { needsReencryption } = await import('../src/utils/encryption.js');
    // token that starts with enc:v1: but missing parts
    const malformed = 'enc:v1:key:iv:tag';
    expect(needsReencryption(malformed)).toBe(false);
  });

  it('decrypt throws DecryptionError for non-string token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { decrypt } = await import('../src/utils/encryption.js');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error testing invalid input
    expect(() => decrypt(123)).toThrow('Decryption failed: Encrypted token must be a string');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('throws when secret is not a string (null value)', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    // Set encryption key to null (not a string)
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: null,
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'Encryption key "key1" must be a non-empty string'
    );
  });

  it('throws when secret is not a string (number value)', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    // Set encryption key to a number (not a string)
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      key1: 12345,
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key1';

    await expect(import('../src/utils/encryption.js')).rejects.toThrow(
      'Encryption key "key1" must be a non-empty string'
    );
  });

  it('decrypt throws DecryptionError when keyId is empty in token', async () => {
    jest.resetModules();
    clearEncryptionEnv();
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({
      current: 'passphrase',
    });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    const { decrypt } = await import('../src/utils/encryption.js');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // token with empty keyId: enc:v1::iv:tag:ciphertext
    const token = 'enc:v1::aXZfdGVzdA==:dGFnX3Rlc3Q=:Y2lwaGVydGVzdA==';
    expect(() => decrypt(token)).toThrow('Decryption failed: Invalid encrypted token format');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
