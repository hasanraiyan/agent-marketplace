import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
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
