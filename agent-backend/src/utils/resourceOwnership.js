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

export default { isResourceOwner, ownerFilterForContext, ownerFieldsForContext };
