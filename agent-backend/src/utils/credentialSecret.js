import crypto from 'crypto';
import config from '../config/index.js';

/**
 * Project credential secret generation & one-way hashing (AD-01 §9, §9.3).
 *
 * Deliberately NOT built on `utils/encryption.js`. That module is
 * reversible AES-256-GCM, correct for Provider API keys and MCP OAuth
 * tokens because Persona must later present their *plaintext* to an
 * external vendor/service. A Project credential secret is different:
 * Persona only ever needs to verify that a *presented* secret matches —
 * it never needs to reconstruct or re-present it to anyone, including the
 * Project itself. One-way hashing is strictly more secure for this case: a
 * full database leak reveals nothing usable, whereas a reversible scheme's
 * security reduces to "the encryption key was also not leaked" (AD-01
 * §9.3, §12.2).
 *
 * The secret is high-entropy and randomly generated (never a human-chosen
 * password), so a fast keyed hash (HMAC-SHA256 with a server-side pepper)
 * is appropriate — an expensive, slow password-hash function (bcrypt/
 * argon2) exists to blunt human-password guessing, which does not apply
 * here, and adding that dependency would be unjustified complexity (per
 * AD-01's own "do not build infrastructure the requirements don't ask
 * for" discipline).
 */

const KEY_ID_BYTES = 16; // 128 bits — public, safe to log/display forever
const SECRET_BYTES = 32; // 256 bits — private, shown once

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function getPepper() {
  const pepper = config.projectCredentialHashSecret;
  if (!pepper) {
    throw new Error(
      'PROJECT_CREDENTIAL_HASH_SECRET is required to hash or verify Project credential secrets'
    );
  }
  return pepper;
}

/**
 * A new, random, public key ID — safe to log, display, and index on
 * forever. Not sequential, to avoid enumeration (AD-01 §12.5).
 */
export function generateKeyId() {
  return `pk_${toBase64Url(crypto.randomBytes(KEY_ID_BYTES))}`;
}

/**
 * A new, random, high-entropy secret — shown to the caller exactly once
 * (AD-01 §9.2). Never stored in this form.
 */
export function generateSecret() {
  return toBase64Url(crypto.randomBytes(SECRET_BYTES));
}

/**
 * One-way hash of a secret, for storage. The only thing ever persisted.
 */
export function hashSecret(secret) {
  if (!secret) {
    throw new Error('hashSecret: a non-empty secret is required');
  }
  return crypto.createHmac('sha256', getPepper()).update(secret).digest('hex');
}

/**
 * Constant-time comparison of a presented secret against a stored hash
 * (AD-01 §12.11 — timing attacks). Never throws on a mismatched/malformed
 * stored hash — returns false, since that is itself part of the "wrong
 * secret" outcome space, not a distinct error case a caller should handle
 * differently.
 */
export function verifySecret(secret, storedHash) {
  if (!secret || !storedHash) {
    return false;
  }

  const candidateHash = crypto.createHmac('sha256', getPepper()).update(secret).digest('hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}

export default { generateKeyId, generateSecret, hashSecret, verifySecret };
