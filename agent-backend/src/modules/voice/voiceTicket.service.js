import crypto from 'crypto';
import config from '../../config/index.js';
import { TICKET_TTL_MS } from './voice.constants.js';

/**
 * Signs and redeems single-use voice session tickets.
 *
 * Express middleware (clerkMiddleware, developerMachineAuthMiddleware,
 * projectAdminAuthMiddleware) never runs on a WebSocket 'upgrade' request —
 * it only sits in the normal HTTP request pipeline. So this ticket is not a
 * convenience for browsers that can't set an Authorization header on a WS
 * handshake; it is the ONLY authentication mechanism the voice gateway has
 * (voice-agent-plan.md §7).
 *
 * Signing follows mcp/oauth-state.js's exact HMAC-SHA256 pattern (same
 * JWT_SECRET, same base64url payload.signature shape, same
 * crypto.timingSafeEqual verification) rather than inventing a second
 * convention for short-lived signed tokens in this codebase.
 *
 * Redemption is additionally single-use: a `jti` is recorded in an
 * in-process Set on first successful redemption, and a second redemption of
 * the same ticket is rejected even if the signature and expiry both still
 * check out. This is Phase-1-appropriate (single backend instance) — a
 * multi-instance deploy would need this set shared (e.g. Redis), noted as a
 * scaling gap in voice-agent-plan.md §11's connection-affinity risk.
 */

const ALGORITHM = 'sha256';

/** jti -> expiry ms. A ticket is removed once redeemed OR once it expires
 * unredeemed — periodic sweep keeps this from growing unbounded even if a
 * ticket is minted and never used. */
const redeemed = new Map();

function sweep() {
  const now = Date.now();
  for (const [jti, exp] of redeemed) {
    if (exp <= now) redeemed.delete(jti);
  }
}

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
    throw new Error('JWT_SECRET is required to sign voice session tickets');
  }
  return secret;
}

function sign(payloadBuffer) {
  return crypto.createHmac(ALGORITHM, getSecret()).update(payloadBuffer).digest();
}

/**
 * Mints a single-use ticket bound to the caller's already-verified identity
 * and to the specific Agent/thread this session runs against — the ticket
 * carries `principalType` so the WS upgrade handler knows which context
 * shape to reconstruct (ProjectAdminContext today; ProjectMachineContext /
 * ProjectRuntimeContext once the machine route lands in Phase 2), never
 * inferring it from the wire (voice-agent-plan.md §7).
 *
 * @param {{principalType: string, domain: string, agentId: string, subjectId: string, threadId?: string|null}} claims
 * @returns {{ticket: string, expiresAt: string}}
 */
export function mintVoiceTicket(claims) {
  sweep();

  const jti = crypto.randomUUID();
  const exp = Date.now() + TICKET_TTL_MS;
  const body = { ...claims, jti, exp };

  const payloadBuffer = Buffer.from(JSON.stringify(body), 'utf8');
  const signature = sign(payloadBuffer);
  const ticket = `${toBase64Url(payloadBuffer)}.${toBase64Url(signature)}`;

  return { ticket, expiresAt: new Date(exp).toISOString() };
}

/**
 * Verifies signature + expiry, then atomically marks the ticket redeemed.
 * Throws on any failure — bad signature, expired, or already redeemed —
 * the WS upgrade handler must close the socket on any of these, never
 * distinguishing which for the client (a replayed ticket and a forged one
 * should look identical from the outside).
 *
 * @param {string} ticket
 * @returns {{principalType: string, domain: string, agentId: string, subjectId: string, threadId?: string|null}}
 */
export function redeemVoiceTicket(ticket) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) {
    throw new Error('Invalid voice ticket');
  }

  const [payloadPart, signaturePart] = ticket.split('.');
  if (!payloadPart || !signaturePart) {
    throw new Error('Invalid voice ticket');
  }

  const payloadBuffer = fromBase64Url(payloadPart);
  const expectedSignature = sign(payloadBuffer);
  const actualSignature = fromBase64Url(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Voice ticket signature mismatch');
  }

  const body = JSON.parse(payloadBuffer.toString('utf8'));

  if (typeof body.exp !== 'number' || Date.now() > body.exp) {
    throw new Error('Voice ticket expired');
  }

  sweep();
  if (redeemed.has(body.jti)) {
    throw new Error('Voice ticket already used');
  }
  redeemed.set(body.jti, body.exp);

  const { jti, exp, ...claims } = body;
  return claims;
}

export default { mintVoiceTicket, redeemVoiceTicket };
