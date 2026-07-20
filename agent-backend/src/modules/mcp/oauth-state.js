import crypto from 'crypto';
import config from '../../config/index.js';

const ALGORITHM = 'sha256';
const DEFAULT_TTL_SECONDS = 600; // 10 minutes

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

function getSecret() {
  const secret = config.jwt?.secret;
  if (!secret) {
    throw new Error('JWT_SECRET is required to sign OAuth state tokens');
  }
  return secret;
}

function sign(payloadBuffer) {
  return crypto.createHmac(ALGORITHM, getSecret()).update(payloadBuffer).digest();
}

/**
 * Signs a short-lived OAuth state payload so the callback route can recover
 * who/what initiated the flow without a Clerk session - the redirect from
 * the external authorization server carries no auth header.
 */
export function signOAuthState(payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const body = {
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  };

  const payloadBuffer = Buffer.from(JSON.stringify(body), 'utf8');
  const signature = sign(payloadBuffer);

  return `${toBase64Url(payloadBuffer)}.${toBase64Url(signature)}`;
}

export function verifyOAuthState(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid OAuth state token');
  }

  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw new Error('Invalid OAuth state token');
  }

  const payloadBuffer = fromBase64Url(payloadPart);
  const expectedSignature = sign(payloadBuffer);
  const actualSignature = fromBase64Url(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('OAuth state signature mismatch');
  }

  const body = JSON.parse(payloadBuffer.toString('utf8'));

  if (typeof body.exp !== 'number' || Date.now() > body.exp) {
    throw new Error('OAuth state token expired');
  }

  return body;
}
