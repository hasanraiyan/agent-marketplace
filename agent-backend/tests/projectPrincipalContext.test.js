import {
  createProjectMachineContext,
  createProjectRuntimeContext,
  createProjectAdminContext,
} from '../src/modules/auth/projectPrincipalContext.js';

describe('projectPrincipalContext — createProjectMachineContext', () => {
  it('builds a context with the trusted domain and credentialId', () => {
    const context = createProjectMachineContext({
      domain: 'beyond-campus',
      credentialId: 'cred_abc123',
    });
    expect(context).toEqual({
      domain: 'beyond-campus',
      principalType: 'ProjectMachine',
      credentialId: 'cred_abc123',
    });
  });

  it('has no externalUserId field at all — a machine context cannot represent a runtime subject', () => {
    const context = createProjectMachineContext({
      domain: 'beyond-campus',
      credentialId: 'cred_abc123',
    });
    expect('externalUserId' in context).toBe(false);
  });

  it.each([
    [{}, 'domain'],
    [{ domain: 'beyond-campus' }, 'credentialId'],
    [{ credentialId: 'cred_abc123' }, 'domain'],
  ])('fails closed when a required field is missing: %p', (input) => {
    expect(() => createProjectMachineContext(input)).toThrow(/truthy/);
  });

  it('fails closed when called with no arguments at all', () => {
    expect(() => createProjectMachineContext()).toThrow(/truthy "domain" is required/);
  });

  it('returns a frozen context object', () => {
    const context = createProjectMachineContext({ domain: 'd', credentialId: 'c' });
    expect(Object.isFrozen(context)).toBe(true);
  });
});

describe('projectPrincipalContext — createProjectRuntimeContext', () => {
  it('builds a context with domain, credentialId, and the asserted externalUserId', () => {
    const context = createProjectRuntimeContext({
      domain: 'beyond-campus',
      credentialId: 'cred_abc123',
      externalUserId: 'sabik',
    });
    expect(context).toEqual({
      domain: 'beyond-campus',
      principalType: 'ProjectRuntime',
      credentialId: 'cred_abc123',
      externalUserId: 'sabik',
    });
  });

  it('never derives externalUserId from anything other than the caller-supplied value', () => {
    const context = createProjectRuntimeContext({
      domain: 'beyond-campus',
      credentialId: 'cred_abc123',
      externalUserId: 'rahul',
    });
    expect(context.externalUserId).toBe('rahul');
  });

  it.each([
    [{ credentialId: 'c', externalUserId: 'u' }],
    [{ domain: 'd', externalUserId: 'u' }],
    [{ domain: 'd', credentialId: 'c' }],
    [{}],
  ])('fails closed when a required field is missing: %p', (input) => {
    expect(() => createProjectRuntimeContext(input)).toThrow(/truthy/);
  });

  it('same externalUserId string under two different domains produces two distinct contexts', () => {
    const beyondCampusRahul = createProjectRuntimeContext({
      domain: 'beyond-campus',
      credentialId: 'cred_bc',
      externalUserId: 'rahul',
    });
    const coursifyRahul = createProjectRuntimeContext({
      domain: 'coursify',
      credentialId: 'cred_coursify',
      externalUserId: 'rahul',
    });
    expect(beyondCampusRahul).not.toEqual(coursifyRahul);
    expect(beyondCampusRahul.domain).not.toBe(coursifyRahul.domain);
  });

  it('returns a frozen context object', () => {
    const context = createProjectRuntimeContext({
      domain: 'd',
      credentialId: 'c',
      externalUserId: 'u',
    });
    expect(Object.isFrozen(context)).toBe(true);
  });
});

describe('projectPrincipalContext — createProjectAdminContext', () => {
  it('builds a context with domain, personaUserId, and membershipRole', () => {
    const context = createProjectAdminContext({
      domain: 'beyond-campus',
      personaUserId: '64f0000000000000000000ab',
      membershipRole: 'Admin',
    });
    expect(context).toEqual({
      domain: 'beyond-campus',
      principalType: 'ProjectAdmin',
      personaUserId: '64f0000000000000000000ab',
      membershipRole: 'Admin',
    });
  });

  it('never has an externalUserId field, even if one is erroneously supplied', () => {
    const context = createProjectAdminContext({
      domain: 'beyond-campus',
      personaUserId: 'raiyan-id',
      membershipRole: 'Admin',
      // @ts-expect-error extra, unsupported field on purpose
      externalUserId: 'sabik',
    });
    expect('externalUserId' in context).toBe(false);
    expect(Object.keys(context).sort()).toEqual([
      'domain',
      'membershipRole',
      'personaUserId',
      'principalType',
    ]);
  });

  it.each(['Owner', 'Member', 'Viewer', '', undefined, null, 'admin'])(
    'rejects any membershipRole other than the v1-supported "Admin": %p',
    (badRole) => {
      expect(() =>
        createProjectAdminContext({
          domain: 'beyond-campus',
          personaUserId: 'raiyan-id',
          membershipRole: badRole,
        })
      ).toThrow(/unsupported membershipRole/);
    }
  );

  it.each([
    [{ personaUserId: 'p', membershipRole: 'Admin' }],
    [{ domain: 'd', membershipRole: 'Admin' }],
  ])('fails closed when domain/personaUserId is missing: %p', (input) => {
    expect(() => createProjectAdminContext(input)).toThrow(/truthy|unsupported membershipRole/);
  });

  it('returns a frozen context object', () => {
    const context = createProjectAdminContext({
      domain: 'd',
      personaUserId: 'p',
      membershipRole: 'Admin',
    });
    expect(Object.isFrozen(context)).toBe(true);
  });
});

describe('projectPrincipalContext — cross-context distinguishability (AD-07 §8)', () => {
  it('ProjectMachineContext and ProjectRuntimeContext are structurally distinguishable, not the same shape with an optional field', () => {
    const machine = createProjectMachineContext({ domain: 'd', credentialId: 'c' });
    const runtime = createProjectRuntimeContext({
      domain: 'd',
      credentialId: 'c',
      externalUserId: 'u',
    });

    expect(machine.principalType).not.toBe(runtime.principalType);
    expect('externalUserId' in machine).toBe(false);
    expect('externalUserId' in runtime).toBe(true);
  });

  it('every context type has a distinct principalType value', () => {
    const machine = createProjectMachineContext({ domain: 'd', credentialId: 'c' });
    const runtime = createProjectRuntimeContext({
      domain: 'd',
      credentialId: 'c',
      externalUserId: 'u',
    });
    const admin = createProjectAdminContext({
      domain: 'd',
      personaUserId: 'p',
      membershipRole: 'Admin',
    });

    const types = [machine.principalType, runtime.principalType, admin.principalType];
    expect(new Set(types).size).toBe(3);
  });
});
