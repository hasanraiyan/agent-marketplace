import BaseError from '../../utils/errors/BaseError.js';

// TURN_CONTEXT_RCP_RESOLVERS_PLAN.md — `context` is a flat object of
// string/number/boolean values only (no nested objects/arrays), capped at
// 2000 bytes serialized. Own limit, separate from `contextOverride`'s
// 4000-char prose cap: this holds identifiers, not prose, and banning
// nesting closes off using it to smuggle a large payload past the cap.
const MAX_TURN_CONTEXT_BYTES = 2000;

/**
 * Validates a request body's `context` field (distinct from
 * `contextOverride` — never shown to the model, only ever read by an RCP
 * resolver via `getConfig().configurable.turnContext`). Returns `undefined`
 * unchanged (no context sent this turn); throws a 400 `BaseError` on any
 * shape violation rather than coercing/dropping bad input silently.
 */
export function validateTurnContext(context) {
  if (context === undefined) return undefined;

  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new BaseError('context must be a flat object', 400, 'INVALID_CONTEXT');
  }

  for (const [key, value] of Object.entries(context)) {
    const valueType = typeof value;
    if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
      throw new BaseError(
        `context.${key} must be a string, number, or boolean`,
        400,
        'INVALID_CONTEXT'
      );
    }
  }

  const byteLength = Buffer.byteLength(JSON.stringify(context), 'utf8');
  if (byteLength > MAX_TURN_CONTEXT_BYTES) {
    throw new BaseError(
      `context must be ${MAX_TURN_CONTEXT_BYTES} bytes or fewer when serialized`,
      400,
      'CONTEXT_TOO_LARGE'
    );
  }

  return context;
}
