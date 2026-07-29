import { jest } from '@jest/globals';

const ORIGINAL_PEPPER = process.env.PROJECT_CREDENTIAL_HASH_SECRET;

function clearPepperEnv() {
  delete process.env.PROJECT_CREDENTIAL_HASH_SECRET;
}

function restorePepperEnv() {
  clearPepperEnv();
  if (ORIGINAL_PEPPER !== undefined) {
    process.env.PROJECT_CREDENTIAL_HASH_SECRET = ORIGINAL_PEPPER;
  }
}

describe('credentialSecret util', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    restorePepperEnv();
  });

  describe('generateKeyId', () => {
    it('produces a public, prefixed, non-sequential identifier', async () => {
      jest.resetModules();
      const { generateKeyId } = await import('../src/utils/credentialSecret.js');

      const a = generateKeyId();
      const b = generateKeyId();

      expect(a).toMatch(/^pk_/);
      expect(b).toMatch(/^pk_/);
      expect(a).not.toBe(b); // random, not sequential/guessable
    });
  });

  describe('generateSecret', () => {
    it('produces a high-entropy, non-repeating secret', async () => {
      jest.resetModules();
      const { generateSecret } = await import('../src/utils/credentialSecret.js');

      const a = generateSecret();
      const b = generateSecret();

      expect(typeof a).toBe('string');
      expect(a.length).toBeGreaterThan(30); // 256 bits, base64url-encoded
      expect(a).not.toBe(b);
    });
  });

  describe('hashSecret / verifySecret', () => {
    it('hashes and verifies a matching secret', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { hashSecret, verifySecret } = await import('../src/utils/credentialSecret.js');

      const secret = 'a-very-random-secret-value';
      const hash = hashSecret(secret);

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(secret);
      expect(verifySecret(secret, hash)).toBe(true);
    });

    it('rejects a non-matching secret', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { hashSecret, verifySecret } = await import('../src/utils/credentialSecret.js');

      const hash = hashSecret('the-real-secret');
      expect(verifySecret('a-guessed-secret', hash)).toBe(false);
    });

    it('produces different hashes under different peppers for the same secret', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'pepper-one';
      const { hashSecret: hashWithPepperOne } = await import('../src/utils/credentialSecret.js');
      const hash1 = hashWithPepperOne('same-secret');

      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'pepper-two';
      const { hashSecret: hashWithPepperTwo } = await import('../src/utils/credentialSecret.js');
      const hash2 = hashWithPepperTwo('same-secret');

      expect(hash1).not.toBe(hash2);
    });

    it('never returns the raw secret from hashSecret', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { hashSecret } = await import('../src/utils/credentialSecret.js');

      const secret = 'super-secret-value-do-not-leak';
      const hash = hashSecret(secret);
      expect(hash).not.toContain(secret);
    });

    it('throws when hashing without a configured pepper (fails closed, not silently)', async () => {
      jest.resetModules();
      clearPepperEnv();
      const { hashSecret } = await import('../src/utils/credentialSecret.js');

      expect(() => hashSecret('anything')).toThrow(/PROJECT_CREDENTIAL_HASH_SECRET is required/);
    });

    it('throws when verifying without a configured pepper (fails closed, not silently)', async () => {
      jest.resetModules();
      clearPepperEnv();
      const { verifySecret } = await import('../src/utils/credentialSecret.js');

      expect(() => verifySecret('secret', 'some-hash')).toThrow(
        /PROJECT_CREDENTIAL_HASH_SECRET is required/
      );
    });

    it('returns false (not a throw) for empty/missing secret or stored hash inputs', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { verifySecret } = await import('../src/utils/credentialSecret.js');

      expect(verifySecret('', 'some-hash')).toBe(false);
      expect(verifySecret('secret', '')).toBe(false);
      expect(verifySecret(null, null)).toBe(false);
      expect(verifySecret(undefined, undefined)).toBe(false);
    });

    it('returns false rather than throwing for a malformed/mismatched-length stored hash', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { verifySecret } = await import('../src/utils/credentialSecret.js');

      expect(verifySecret('secret', 'not-a-valid-hex-hash-at-all')).toBe(false);
    });

    it('hashSecret throws for an empty secret', async () => {
      jest.resetModules();
      clearPepperEnv();
      process.env.PROJECT_CREDENTIAL_HASH_SECRET = 'test-pepper';
      const { hashSecret } = await import('../src/utils/credentialSecret.js');

      expect(() => hashSecret('')).toThrow(/non-empty secret is required/);
    });
  });
});
