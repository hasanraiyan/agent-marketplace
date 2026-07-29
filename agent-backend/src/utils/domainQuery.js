/**
 * Domain-scoped query helper (Developer Platform foundation, AD-05).
 *
 * Builds a MongoDB filter that always includes the trusted `domain` from the
 * caller's authenticated request context. This is the single place the
 * "missing Domain must fail closed" guarantee lives — repositories are
 * expected to build every Domain-scoped filter through this helper rather
 * than hand-writing filter literals, so that a query is only ever unscoped
 * if this function is bypassed entirely (an auditable, greppable event),
 * never because a predicate was silently forgotten.
 *
 * This module is a foundation primitive only (Developer Platform PR-1). No
 * repository is migrated to use it yet — see the master implementation
 * blueprint, §9 and §43.
 */

/**
 * @param {*} domain - The trusted domain value from the authenticated request
 *   context. Must be truthy. Never accept this from unauthenticated client
 *   input — it must always originate from request-context construction
 *   (Project credential resolution or the Persona principal wrapper).
 * @param {object} [extraFilter] - Additional query predicates to combine with
 *   the domain scope. Must not itself contain a `domain` key.
 * @returns {object} A filter object guaranteed to include the trusted domain.
 * @throws {Error} If `domain` is falsy, or if `extraFilter` supplies its own
 *   `domain` key.
 */
export function scopedFilter(domain, extraFilter = {}) {
  if (!domain) {
    throw new Error(
      'scopedFilter: a truthy domain is required — refusing to build an unscoped query'
    );
  }

  if (extraFilter && Object.prototype.hasOwnProperty.call(extraFilter, 'domain')) {
    throw new Error(
      'scopedFilter: extraFilter must not include its own "domain" key — the trusted domain ' +
        'comes only from the authenticated request context, never from query input'
    );
  }

  return { ...extraFilter, domain };
}

export default { scopedFilter };
