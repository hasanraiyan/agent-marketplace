import { jest } from '@jest/globals';

describe('config module', () => {
  const origPort = process.env.PORT;
  const origEnv = process.env.NODE_ENV;
  const origMongoUri = process.env.MONGODB_URI;
  const origEncryptionKeys = process.env.DB_ENCRYPTION_KEYS;
  const origEncryptionActiveKeyId = process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
  const origJwtSecret = process.env.JWT_SECRET;
  const origJwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  afterEach(() => {
    if (origPort !== undefined) process.env.PORT = origPort;
    else delete process.env.PORT;
    if (origEnv !== undefined) process.env.NODE_ENV = origEnv;
    else delete process.env.NODE_ENV;
    if (origMongoUri !== undefined) process.env.MONGODB_URI = origMongoUri;
    else delete process.env.MONGODB_URI;
    if (origEncryptionKeys !== undefined) process.env.DB_ENCRYPTION_KEYS = origEncryptionKeys;
    else delete process.env.DB_ENCRYPTION_KEYS;
    if (origEncryptionActiveKeyId !== undefined) {
      process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = origEncryptionActiveKeyId;
    } else {
      delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    }
    if (origJwtSecret !== undefined) process.env.JWT_SECRET = origJwtSecret;
    else delete process.env.JWT_SECRET;
    if (origJwtRefreshSecret !== undefined) process.env.JWT_REFRESH_SECRET = origJwtRefreshSecret;
    else delete process.env.JWT_REFRESH_SECRET;
    jest.resetModules();
  });

  test('defaults when env vars unset', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    jest.resetModules();
    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));
    const { default: config } = await import('../src/config/index.js');
    expect(config.port).toBe(3000);
    expect(config.env).toBe('development');
    expect(config.dbEncryptionKeys).toBeNull();
    expect(config.dbEncryptionActiveKeyId).toBeNull();
    expect(config.jwt.secret).toBeUndefined();
    expect(config.jwt.refreshSecret).toBeUndefined();
  });

  test('uses provided PORT only', async () => {
    process.env.PORT = '4242';
    delete process.env.NODE_ENV;
    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));
    const { default: config } = await import('../src/config/index.js');
    expect(config.port).toBe(4242);
    expect(config.env).toBe('development');
    expect(config.dbEncryptionKeys).toBeNull();
    expect(config.dbEncryptionActiveKeyId).toBeNull();
  });

  test('uses provided NODE_ENV only', async () => {
    delete process.env.PORT;
    process.env.NODE_ENV = 'production';
    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));
    const { default: config } = await import('../src/config/index.js');
    expect(config.port).toBe(3000);
    expect(config.env).toBe('production');
    expect(config.dbEncryptionKeys).toBeNull();
    expect(config.dbEncryptionActiveKeyId).toBeNull();
  });

  test('uses all provided', async () => {
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'test';
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({ current: 'passphrase' });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.port).toBe(8080);
    expect(config.env).toBe('test');
    expect(config.dbEncryptionKeys).toEqual({ current: 'passphrase' });
    expect(config.dbEncryptionActiveKeyId).toBe('current');
  });

  test('empty PORT falls back to default', async () => {
    process.env.PORT = '';
    delete process.env.NODE_ENV;
    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.port).toBe(3000);
  });

  test('parses rotating encryption config from env', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = JSON.stringify({ current: 'passphrase' });
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'current';
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.dbEncryptionKeys).toEqual({ current: 'passphrase' });
    expect(config.dbEncryptionActiveKeyId).toBe('current');
  });

  test('throws when DB_ENCRYPTION_KEYS is invalid JSON', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '{invalid json}';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be valid JSON'
    );
  });

  test('DB_ENCRYPTION_KEYS empty string returns null', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.dbEncryptionKeys).toBeNull();
  });

  test('DB_ENCRYPTION_KEYS whitespace returns null', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '   ';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.dbEncryptionKeys).toBeNull();
  });

  test('DB_ENCRYPTION_KEYS JSON array throws error', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '[1,2,3]';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be a JSON object'
    );
  });

  test('DB_ENCRYPTION_KEYS JSON string throws error', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '"hello"';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be a JSON object'
    );
  });

  test('DB_ENCRYPTION_KEYS JSON number throws error', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = '42';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be a JSON object'
    );
  });

  test('DB_ENCRYPTION_KEYS JSON boolean throws error', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = 'true';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be a JSON object'
    );
  });

  test('DB_ENCRYPTION_KEYS JSON null throws error', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    process.env.DB_ENCRYPTION_KEYS = 'null';
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    await expect(import('../src/config/index.js')).rejects.toThrow(
      'DB_ENCRYPTION_KEYS must be a JSON object'
    );
  });

  test('DB_ENCRYPTION_ACTIVE_KEY_ID set uses value', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DB_ENCRYPTION_KEYS;
    process.env.DB_ENCRYPTION_ACTIVE_KEY_ID = 'key123';
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.dbEncryptionActiveKeyId).toBe('key123');
  });

  test('empty NODE_ENV falls back to default', async () => {
    delete process.env.PORT;
    process.env.NODE_ENV = '';
    delete process.env.DB_ENCRYPTION_KEYS;
    delete process.env.DB_ENCRYPTION_ACTIVE_KEY_ID;
    jest.resetModules();
    const { default: config } = await import('../src/config/index.js');
    expect(config.env).toBe('development');
  });
});
