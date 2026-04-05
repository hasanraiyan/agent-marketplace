import { jest } from '@jest/globals';
import {
  buildKeyConfig,
  formatEnvLines,
  generateEncodedKey,
  generateKeyId,
  parseExistingKeys,
  runCli,
} from '../scripts/generate-encryption-key.js';

describe('generate encryption key script', () => {
  test('generateKeyId uses a safe timestamp-based format', () => {
    const keyId = generateKeyId(new Date('2026-03-27T03:30:00.000Z'));
    expect(keyId).toBe('key_20260327T033000Z');
  });

  test('generateEncodedKey creates a base64-prefixed 32-byte key', () => {
    const key = generateEncodedKey(() => Buffer.alloc(32, 7));
    expect(key).toBe(`base64:${Buffer.alloc(32, 7).toString('base64')}`);
  });

  test('parseExistingKeys returns an empty object when unset', () => {
    expect(parseExistingKeys('')).toEqual({});
  });

  test('buildKeyConfig merges a new key into the existing keyring', () => {
    const config = buildKeyConfig(
      {
        keyId: 'next',
        existingKeys: {
          current: 'base64:existing',
        },
      },
      () => Buffer.alloc(32, 9)
    );

    expect(config).toEqual({
      keyId: 'next',
      keys: {
        current: 'base64:existing',
        next: `base64:${Buffer.alloc(32, 9).toString('base64')}`,
      },
    });
  });

  test('buildKeyConfig rejects duplicate ids unless forced', () => {
    expect(() =>
      buildKeyConfig({
        keyId: 'current',
        existingKeys: { current: 'base64:existing' },
      })
    ).toThrow('Key "current" already exists. Choose a new id or rerun with --force.');
  });

  test('formatEnvLines returns copy-paste ready env assignments', () => {
    expect(
      formatEnvLines({
        keyId: 'next',
        keys: { next: 'base64:value' },
      })
    ).toBe('DB_ENCRYPTION_ACTIVE_KEY_ID=next\nDB_ENCRYPTION_KEYS={"next":"base64:value"}');
  });

  test('runCli merges with DB_ENCRYPTION_KEYS from env', () => {
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };

    const exitCode = runCli({
      argv: ['next'],
      env: {
        DB_ENCRYPTION_KEYS: JSON.stringify({ current: 'base64:existing' }),
      },
      stdout,
      stderr,
    });

    expect(exitCode).toBe(0);
    expect(stderr.write).not.toHaveBeenCalled();
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('DB_ENCRYPTION_ACTIVE_KEY_ID=next')
    );
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('"current":"base64:existing"')
    );
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('"next":"base64:'));
  });
});
