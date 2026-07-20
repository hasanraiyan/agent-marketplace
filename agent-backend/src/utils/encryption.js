import crypto from 'crypto';
import config from '../config/index.js';
import { DecryptionError } from './errors/index.js';

/**
 * AES-256-GCM field-level encryption with versioned key rotation support.
 *
 * Encrypted values use this format, which encodes everything needed for
 * decryption except the key material itself:
 *   `enc:v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 *
 * Key rotation is supported by keeping a map of key IDs → key material in
 * the DB_ENCRYPTION_KEYS env var. The active key (DB_ENCRYPTION_ACTIVE_KEY_ID)
 * is used for NEW encryptions; old key IDs remain decryptable. Callers detect
 * stale ciphertexts via `needsReencryption()` and can re-encrypt at read time.
 *
 * The AAD (Additional Authenticated Data) for each ciphertext is the token
 * header (enc:v1:<keyId>), binding the key ID to the ciphertext so that an
 * attacker who swaps a key ID in a stored token triggers an auth tag mismatch.
 *
 * Payload type (string vs JSON) is encoded in the first byte of the plaintext
 * so `encrypt` and `decrypt` transparently handle both strings and objects.
 *
 * In development, a missing active key emits a warning but allows operation
 * in plaintext mode. In production, missing keys throw at startup.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KDF_SALT = 'db-encryption-salt';
const TOKEN_FAMILY = 'enc';
const TOKEN_VERSION = 'v1';
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const PAYLOAD_TYPE_STRING = 1;
const PAYLOAD_TYPE_JSON = 2;

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

function deriveKeyMaterial(secret) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Encryption key material must be a non-empty string');
  }

  if (secret.startsWith('base64:')) {
    const keyMaterial = Buffer.from(secret.slice('base64:'.length), 'base64');

    if (keyMaterial.length !== 32) {
      throw new Error('base64 encryption keys must decode to 32 bytes');
    }

    return keyMaterial;
  }

  return crypto.scryptSync(secret, KDF_SALT, 32);
}

function validateKeyId(keyId) {
  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new Error('Encryption key ids must be non-empty strings');
  }

  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error(
      'Encryption key ids may only contain letters, numbers, underscores, and hyphens'
    );
  }
}

function buildKeyring(rawKeys) {
  if (!rawKeys) return new Map();

  if (Object.keys(rawKeys).length === 0) {
    throw new Error('DB_ENCRYPTION_KEYS must contain at least one key');
  }

  return new Map(
    Object.entries(rawKeys).map(([keyId, secret]) => {
      validateKeyId(keyId);

      if (typeof secret !== 'string' || secret.length === 0) {
        throw new Error(`Encryption key "${keyId}" must be a non-empty string`);
      }

      return [keyId, deriveKeyMaterial(secret)];
    })
  );
}

function isVersionedToken(token) {
  return typeof token === 'string' && token.startsWith(`${TOKEN_FAMILY}:`);
}

function parseVersionedToken(token) {
  const parts = token.split(':');

  if (parts.length !== 6 || parts[0] !== TOKEN_FAMILY || parts[1] !== TOKEN_VERSION) {
    throw new Error('Invalid encrypted token format');
  }

  const [, , keyId, ivEncoded, tagEncoded, ciphertextEncoded] = parts;

  if (!keyId || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted token format');
  }

  return {
    keyId,
    iv: fromBase64Url(ivEncoded),
    tag: fromBase64Url(tagEncoded),
    ciphertext: fromBase64Url(ciphertextEncoded),
  };
}

function serializeVersionedToken({ keyId, iv, tag, ciphertext }) {
  return [
    TOKEN_FAMILY,
    TOKEN_VERSION,
    keyId,
    toBase64Url(iv),
    toBase64Url(tag),
    toBase64Url(ciphertext),
  ].join(':');
}

function serializeCurrentPlaintext(value) {
  if (typeof value === 'string') {
    return Buffer.concat([Buffer.from([PAYLOAD_TYPE_STRING]), Buffer.from(value, 'utf8')]);
  }

  return Buffer.concat([
    Buffer.from([PAYLOAD_TYPE_JSON]),
    Buffer.from(JSON.stringify(value), 'utf8'),
  ]);
}

function decryptCurrentPlaintext(plaintextBuffer) {
  const payloadType = plaintextBuffer[0];
  const payload = plaintextBuffer.subarray(1).toString('utf8');

  if (payloadType === PAYLOAD_TYPE_STRING) {
    return payload;
  }

  if (payloadType === PAYLOAD_TYPE_JSON) {
    return JSON.parse(payload);
  }

  throw new Error('Unsupported encrypted payload type');
}

function decryptWithKey(ciphertext, keyMaterial, iv, tag, aad) {
  const decipher = crypto.createDecipheriv(ALGORITHM, keyMaterial, iv);

  if (aad) {
    decipher.setAAD(aad);
  }

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

const keyring = buildKeyring(config.dbEncryptionKeys);
const activeKeyId = config.dbEncryptionActiveKeyId || null;

if (keyring.size > 0) {
  if (!activeKeyId) {
    throw new Error('DB_ENCRYPTION_ACTIVE_KEY_ID is required when DB_ENCRYPTION_KEYS is set');
  }

  if (!keyring.has(activeKeyId)) {
    throw new Error('DB_ENCRYPTION_ACTIVE_KEY_ID must match a key in DB_ENCRYPTION_KEYS');
  }
}

const activeKey = activeKeyId ? keyring.get(activeKeyId) : null;
const enabled = Boolean(activeKey);

// Fail closed in production, warn in development
if (!enabled) {
  if (config.env === 'production') {
    throw new Error(
      'Encryption is DISABLED but required in production. ' +
        'Please configure DB_ENCRYPTION_KEYS and DB_ENCRYPTION_ACTIVE_KEY_ID.'
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      '⚠️  WARNING: DB encryption is DISABLED. API keys will be stored in plaintext. ' +
        'Set DB_ENCRYPTION_KEYS and DB_ENCRYPTION_ACTIVE_KEY_ID to enable.'
    );
  }
}

function decryptVersionedToken(token) {
  const { keyId, iv, tag, ciphertext } = parseVersionedToken(token);
  const keyMaterial = keyring.get(keyId);

  if (!keyMaterial) {
    throw new Error(`Unknown encryption key id: ${keyId}`);
  }

  const header = `${TOKEN_FAMILY}:${TOKEN_VERSION}:${keyId}`;
  const plaintext = decryptWithKey(ciphertext, keyMaterial, iv, tag, Buffer.from(header, 'utf8'));

  return decryptCurrentPlaintext(plaintext);
}

/**
 * @returns {boolean} Whether encryption is enabled (active key configured)
 */
export function isEnabled() {
  return enabled;
}

/**
 * Checks whether a token was encrypted with a key that is no longer the
 * active key. Used during reads to detect values that should be re-encrypted
 * with the current active key as part of a key rotation migration.
 *
 * @param {string} token - The encrypted token to check
 * @returns {boolean} True if the token should be re-encrypted
 */
export function needsReencryption(token) {
  if (!enabled || !activeKey || typeof token !== 'string') {
    return false;
  }

  if (!isVersionedToken(token)) {
    return true;
  }

  try {
    return parseVersionedToken(token).keyId !== activeKeyId;
  } catch {
    return false;
  }
}

export function encrypt(value) {
  if (!enabled) {
    // In production, we should never reach this due to startup check
    if (config.env === 'production') {
      throw new Error('Encryption is required in production but is not enabled');
    }
    return value;
  }

  const plaintext = serializeCurrentPlaintext(value);
  const iv = crypto.randomBytes(IV_LENGTH);

  const header = `${TOKEN_FAMILY}:${TOKEN_VERSION}:${activeKeyId}`;
  const cipher = crypto.createCipheriv(ALGORITHM, activeKey, iv);
  cipher.setAAD(Buffer.from(header, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return serializeVersionedToken({ keyId: activeKeyId, iv, tag, ciphertext });
}

export function decrypt(token) {
  if (!enabled) {
    // If encryption is disabled, we still check if the token looks like it was encrypted.
    // If it was, we can't decrypt it, so we must throw.
    if (isVersionedToken(token)) {
      throw new DecryptionError('Cannot decrypt versioned token: encryption is disabled');
    }
    return token;
  }

  try {
    if (typeof token !== 'string') {
      throw new Error('Encrypted token must be a string');
    }

    return decryptVersionedToken(token);
  } catch (err) {
    const errorDetail = err?.message ?? err?.code ?? err;
    // eslint-disable-next-line no-console
    console.warn('decrypt failed:', errorDetail);

    // Throw typed error instead of returning null
    throw new DecryptionError(`Decryption failed: ${errorDetail}`);
  }
}

export default { isEnabled, needsReencryption, encrypt, decrypt };
