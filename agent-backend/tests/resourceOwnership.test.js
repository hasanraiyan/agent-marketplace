import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
  buildDiscoveryFilter,
  isResourceReadable,
} from '../src/utils/resourceOwnership.js';

/**
 * Developer Platform (blueprint Phase 9, PR-28): shared ownership helpers
 * used by every resource type generalized after Agent (Skill onward).
 * Structurally identical to agent.service.js's independently-tested
 * isAgentOwner (PR-25) — mirrors its own test coverage.
 */
describe('resourceOwnership — isResourceOwner', () => {
  test('a PersonaUser context is owner when ownerId matches', () => {
    const resource = { ownerType: 'PersonaUser', ownerId: 'user_1', domain: 'persona' };
    const context = { domain: 'persona', principalType: 'PersonaUser', personaUserId: 'user_1' };
    expect(isResourceOwner(resource, context)).toBe(true);
  });

  test('a PersonaUser context is NOT owner when ownerId differs', () => {
    const resource = { ownerType: 'PersonaUser', ownerId: 'user_1', domain: 'persona' };
    const context = { domain: 'persona', principalType: 'PersonaUser', personaUserId: 'user_2' };
    expect(isResourceOwner(resource, context)).toBe(false);
  });

  test('a ProjectMachineContext is owner of a Project-owned resource in the same Domain', () => {
    const resource = { ownerType: 'Project', domain: 'project-1' };
    const context = { domain: 'project-1', principalType: 'ProjectMachine' };
    expect(isResourceOwner(resource, context)).toBe(true);
  });

  test('a ProjectAdminContext is also owner of a Project-owned resource', () => {
    const resource = { ownerType: 'Project', domain: 'project-1' };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectAdmin',
      personaUserId: 'admin_1',
    };
    expect(isResourceOwner(resource, context)).toBe(true);
  });

  test('a ProjectMachineContext from a DIFFERENT Domain is NOT owner', () => {
    const resource = { ownerType: 'Project', domain: 'project-1' };
    const context = { domain: 'project-2', principalType: 'ProjectMachine' };
    expect(isResourceOwner(resource, context)).toBe(false);
  });

  test('a ProjectRuntimeContext is owner when externalUserId matches', () => {
    const resource = { ownerType: 'ExternalUser', externalOwnerId: 'sabik', domain: 'project-1' };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(isResourceOwner(resource, context)).toBe(true);
  });

  test('a ProjectRuntimeContext with a different externalUserId is NOT owner', () => {
    const resource = { ownerType: 'ExternalUser', externalOwnerId: 'sabik', domain: 'project-1' };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'someone_else',
    };
    expect(isResourceOwner(resource, context)).toBe(false);
  });

  test('a ProjectMachineContext is NOT owner of an ExternalUser-owned resource (wrong owner type)', () => {
    const resource = { ownerType: 'ExternalUser', externalOwnerId: 'sabik', domain: 'project-1' };
    const context = { domain: 'project-1', principalType: 'ProjectMachine' };
    expect(isResourceOwner(resource, context)).toBe(false);
  });

  test('returns false for a null resource or context', () => {
    expect(isResourceOwner(null, { principalType: 'ProjectMachine' })).toBe(false);
    expect(isResourceOwner({ ownerType: 'Project' }, null)).toBe(false);
  });
});

describe('resourceOwnership — ownerFilterForContext', () => {
  test('a PersonaUser context filters by ownerId only', () => {
    const context = { domain: 'persona', principalType: 'PersonaUser', personaUserId: 'user_1' };
    expect(ownerFilterForContext(context)).toEqual({ ownerId: 'user_1' });
  });

  test('a ProjectMachineContext filters by domain + ownerType', () => {
    const context = { domain: 'project-1', principalType: 'ProjectMachine' };
    expect(ownerFilterForContext(context)).toEqual({ domain: 'project-1', ownerType: 'Project' });
  });

  test('a ProjectRuntimeContext filters by domain + ownerType + externalOwnerId', () => {
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(ownerFilterForContext(context)).toEqual({
      domain: 'project-1',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
  });
});

describe('resourceOwnership — ownerFieldsForContext', () => {
  test('a PersonaUser context yields ownerType + ownerId, no domain override', () => {
    const context = { domain: 'persona', principalType: 'PersonaUser', personaUserId: 'user_1' };
    expect(ownerFieldsForContext(context)).toEqual({
      ownerType: 'PersonaUser',
      ownerId: 'user_1',
    });
  });

  test('a ProjectMachineContext yields domain + ownerType: Project', () => {
    const context = { domain: 'project-1', principalType: 'ProjectMachine' };
    expect(ownerFieldsForContext(context)).toEqual({ domain: 'project-1', ownerType: 'Project' });
  });

  test('a ProjectRuntimeContext yields domain + ownerType: ExternalUser + externalOwnerId', () => {
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(ownerFieldsForContext(context)).toEqual({
      domain: 'project-1',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
  });
});

// Regression coverage: RcpSource's own copy of this three-mode filter
// shipped with NO ownership branching at all (just `scopedFilter(domain,
// extra)`) — any caller in the Domain, including any other external user,
// could list every resource regardless of owner. This shared builder is
// what every self-serve discovery filter should route through instead of
// hand-rolling the same branching per domain.
describe('resourceOwnership — buildDiscoveryFilter', () => {
  const sharedFilter = { isPublic: true };

  test('a ProjectMachine/ProjectAdmin context sees everything in the Domain, ignoring scope', () => {
    const context = { domain: 'project-1', principalType: 'ProjectMachine' };
    expect(buildDiscoveryFilter(context, { scope: 'mine' }, { extra: 1 }, sharedFilter)).toEqual({
      domain: 'project-1',
      extra: 1,
    });
  });

  test('a ProjectRuntimeContext with scope: "mine" is Domain- AND Subject-scoped', () => {
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(buildDiscoveryFilter(context, { scope: 'mine' }, {}, sharedFilter)).toEqual({
      domain: 'project-1',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
  });

  test('a ProjectRuntimeContext with no scope falls back to the shared/browsable filter only', () => {
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(buildDiscoveryFilter(context, {}, {}, sharedFilter)).toEqual({
      domain: 'project-1',
      isPublic: true,
    });
  });

  test('extra domain-specific predicates (search, category, ...) survive every mode', () => {
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(buildDiscoveryFilter(context, {}, { name: /foo/i }, { ownerType: 'Project' })).toEqual({
      domain: 'project-1',
      name: /foo/i,
      ownerType: 'Project',
    });
  });
});

describe('resourceOwnership — isResourceReadable', () => {
  const isPublic = (r) => r.isPublic;

  test('the strict owner can always read, regardless of the shared predicate', () => {
    const resource = {
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
      domain: 'project-1',
      isPublic: false,
    };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(isResourceReadable(resource, context, isPublic)).toBe(true);
  });

  test('a non-owner CAN read when the resource matches the shared predicate, same Domain', () => {
    const resource = {
      ownerType: 'ExternalUser',
      externalOwnerId: 'someone-else',
      domain: 'project-1',
      isPublic: true,
    };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(isResourceReadable(resource, context, isPublic)).toBe(true);
  });

  test('a non-owner CANNOT read a private resource', () => {
    const resource = {
      ownerType: 'ExternalUser',
      externalOwnerId: 'someone-else',
      domain: 'project-1',
      isPublic: false,
    };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(isResourceReadable(resource, context, isPublic)).toBe(false);
  });

  test('a shared resource from a DIFFERENT Domain is still not readable', () => {
    const resource = { ownerType: 'Project', domain: 'other-project', isPublic: true };
    const context = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };
    expect(isResourceReadable(resource, context, isPublic)).toBe(false);
  });

  test('returns false for a missing resource', () => {
    expect(isResourceReadable(null, { principalType: 'ProjectMachine' }, isPublic)).toBe(false);
  });
});
