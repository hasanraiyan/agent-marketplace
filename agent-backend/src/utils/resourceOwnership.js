import { scopedFilter } from './domainQuery.js';

/**
 * Shared ownership helpers for Domain-aware resources (Agent, Skill,
 * Knowledge, MCP — every resource type using the `(domain, ownerType,
 * ownerId | externalOwnerId)` shape established across blueprint Phase 9).
 *
 * `agent.service.js`'s own `isAgentOwner` (PR-25) was the first, independent
 * implementation of this exact logic — already reviewed and merged, and
 * deliberately left untouched here rather than retrofitted to reuse this
 * module, since re-touching already-approved live authorization code for a
 * purely structural reason (not a behavior change) isn't worth the risk.
 * Every resource type generalized *after* Agent (Skill, PR-28, and beyond)
 * uses this shared module instead of repeating the same ~15 lines again.
 */

/**
 * True if `context` represents the actual owner of `resource`, across all
 * three owner types. Domain-qualified first: a same-shaped identity in a
 * DIFFERENT Domain is never treated as the owner.
 *
 * @param {{domain?: string, ownerType?: string, ownerId?: *, externalOwnerId?: string}} resource
 * @param {{domain?: string, principalType?: string, personaUserId?: *, externalUserId?: string}} [context]
 * @returns {boolean}
 */
export function isResourceOwner(resource, context) {
  if (!resource || !context) return false;
  if (resource.domain && context.domain && resource.domain !== context.domain) return false;

  switch (resource.ownerType) {
    case 'Project':
      return context.principalType === 'ProjectMachine' || context.principalType === 'ProjectAdmin';
    case 'ExternalUser':
      return (
        context.principalType === 'ProjectRuntime' &&
        Boolean(resource.externalOwnerId) &&
        String(resource.externalOwnerId) === String(context.externalUserId)
      );
    case 'PersonaUser':
    default: {
      const ownerIdStr = resource.ownerId ? resource.ownerId.toString() : null;
      const requestingIdStr = context.personaUserId ? context.personaUserId.toString() : null;
      return Boolean(requestingIdStr && ownerIdStr === requestingIdStr);
    }
  }
}

/**
 * Builds the Mongoose ownership filter for `context` — for repository-layer
 * atomic `findOneAndUpdate`/`findOneAndDelete` queries, which need a query
 * filter (not a fetched document) to enforce ownership in one round trip,
 * unlike `isResourceOwner` which checks an already-fetched document.
 *
 * Project/ExternalUser branches go through `scopedFilter` (AD-05) so the
 * Domain is always part of the filter, not just the ownerType/identity —
 * defense-in-depth consistent with every other Domain-scoped query in this
 * codebase. The PersonaUser branch is unchanged from every existing
 * ownerId-based query (Persona User ObjectIds are already globally unique;
 * no Domain qualification has ever been needed there).
 *
 * @param {Object} context
 * @returns {Object} Mongoose filter fragment
 */
export function ownerFilterForContext(context) {
  if (context?.principalType === 'ProjectMachine' || context?.principalType === 'ProjectAdmin') {
    return scopedFilter(context.domain, { ownerType: 'Project' });
  }
  if (context?.principalType === 'ProjectRuntime') {
    return scopedFilter(context.domain, {
      ownerType: 'ExternalUser',
      externalOwnerId: context.externalUserId,
    });
  }
  return { ownerId: context?.personaUserId };
}

/**
 * The `ownerType`/domain/externalOwnerId fields to merge into a new
 * resource's create payload for `context`. Callers should spread this
 * alongside the resource's other data — e.g.
 * `repository.create({ ...data, ...ownerFieldsForContext(context) })`.
 *
 * @param {Object} context
 * @returns {{domain?: string, ownerType: string, ownerId?: *, externalOwnerId?: string}}
 */
export function ownerFieldsForContext(context) {
  if (context?.principalType === 'ProjectMachine' || context?.principalType === 'ProjectAdmin') {
    return { domain: context.domain, ownerType: 'Project' };
  }
  if (context?.principalType === 'ProjectRuntime') {
    return {
      domain: context.domain,
      ownerType: 'ExternalUser',
      externalOwnerId: context.externalUserId,
    };
  }
  return { ownerType: 'PersonaUser', ownerId: context?.personaUserId };
}

/**
 * The three-mode discovery filter every self-serve resource domain needs
 * (Agent, Skill, RcpSource, KnowledgeBase, ...) — was independently
 * hand-rolled per domain (Agent's `_buildDeveloperDiscoveryFilter`, Skill's
 * own copy of the identical ~15 lines) until RcpSource's copy shipped
 * *without* the ownership branching at all: no `scope: 'mine'` handling
 * and no "shared" fallback, so any caller in the Domain could list every
 * source regardless of owner. One shared builder closes that failure mode
 * for every future domain instead of relying on each new `_buildDiscoveryFilter`
 * to reimplement it correctly from scratch.
 *
 *   - `ProjectMachineContext`/`ProjectAdminContext`: every resource in this
 *     Domain, any owner type — a Project's own admin/machine credential
 *     sees everything happening under its Domain.
 *   - `ProjectRuntimeContext` with `filters.scope === 'mine'`: Domain- AND
 *     Subject-scoped — only this external user's own resources.
 *   - `ProjectRuntimeContext` otherwise: Domain-scoped, `sharedFilter` only
 *     — the domain's "browsable without ownership" set (e.g. `{ isPublic:
 *     true }` for Skill, `{ ownerType: 'Project' }` for a resource with no
 *     public/private toggle of its own, like RcpSource).
 *
 * @param {Object} context
 * @param {{scope?: 'mine'}} [filters]
 * @param {Object} [extra] - domain-specific $match fragments (search, category, ...)
 * @param {Object} sharedFilter - this domain's "shared/browsable" predicate
 * @returns {Object} Mongoose filter fragment, Domain-scoped via `scopedFilter`
 */
export function buildDiscoveryFilter(context, filters = {}, extra = {}, sharedFilter = {}) {
  if (context?.principalType === 'ProjectMachine' || context?.principalType === 'ProjectAdmin') {
    return scopedFilter(context.domain, extra);
  }
  if (filters?.scope === 'mine') {
    return scopedFilter(context?.domain, {
      ...extra,
      ownerType: 'ExternalUser',
      externalOwnerId: context?.externalUserId,
    });
  }
  return scopedFilter(context?.domain, { ...extra, ...sharedFilter });
}

/**
 * True if `context` may READ `resource` — either it's the strict owner
 * (`isResourceOwner`), or `resource` matches this domain's "shared/
 * browsable" predicate (same Domain only, checked here independently of
 * `isResourceOwner`'s own Domain gate since a shared match never calls it).
 *
 * **Read-only. Never use this to authorize a mutation** — update/delete
 * (and anything else that changes state) must keep using `isResourceOwner`
 * or route the write itself through `ownerFilterForContext` as an atomic
 * query-level guard. This exists specifically so a single-resource GET can
 * be more permissive than a write without that permissiveness leaking into
 * whatever else happens to reuse the same fetch — which is exactly the
 * failure mode a fix here once took: widening `getRcpSourceById`'s check to
 * admit shared resources also, transitively, widened every mutation that
 * reused it for its existence/ownership check (update/delete/testConnection
 * all called through `getRcpSourceById`). Give the read path its own named
 * function instead of overloading the strict one.
 *
 * @param {Object} resource
 * @param {Object} context
 * @param {(resource: Object) => boolean} isShared - e.g. `(r) => r.isPublic`
 *   for Skill, `(r) => r.ownerType === 'Project'` for RcpSource.
 * @returns {boolean}
 */
export function isResourceReadable(resource, context, isShared) {
  if (!resource) return false;
  if (isResourceOwner(resource, context)) return true;
  if (resource.domain && context?.domain && resource.domain !== context.domain) return false;
  return Boolean(isShared(resource));
}

export default {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
  buildDiscoveryFilter,
  isResourceReadable,
};
