import idempotencyKeyModel from '../modules/idempotency/idempotencyKey.model.js';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function subjectForContext(context) {
  return context.principalType === 'ProjectRuntime'
    ? `${context.credentialId}:${context.externalUserId}`
    : context.credentialId;
}

/**
 * Opt-in idempotency for `POST /` (create) routes (Developer Platform,
 * Feature 5). Reads an optional `Idempotency-Key` request header:
 *
 * - Absent: complete no-op (`next()`) — zero behavior change for every
 *   existing caller, this is purely additive.
 * - Present, no prior response for this `(domain, credential/externalUser,
 *   key)` tuple: lets the request through, then persists whatever status
 *   code + body the controller sent (wrapping `res.json`), fire-and-forget
 *   so a persistence failure never blocks the real response.
 * - Present, a prior response exists: replays that exact `{statusCode,
 *   body}` and never reaches the controller — a safe retry after a
 *   timeout returns the original result instead of creating a duplicate.
 *
 * Must run after `developerMachineAuthMiddleware` (needs `req.projectContext`
 * for cache-key scoping) and before the resource's `validateBody`/controller.
 */
export function idempotency() {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    const context = req.projectContext;
    if (!key || !context) {
      return next();
    }

    const cacheKey = `${context.domain}:${subjectForContext(context)}:${key}`;

    try {
      const existing = await idempotencyKeyModel.findOne({ cacheKey }).lean();
      if (existing) {
        return res.status(existing.statusCode).json(existing.body);
      }
    } catch {
      // Cache lookup failure shouldn't block the real request.
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      idempotencyKeyModel
        .create({
          cacheKey,
          statusCode: res.statusCode,
          body,
          expiresAt: new Date(Date.now() + TTL_MS),
        })
        .catch(() => {});
      return originalJson(body);
    };

    next();
  };
}

export default idempotency;
