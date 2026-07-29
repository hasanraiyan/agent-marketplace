import {
  PERSONA_DOMAIN,
  PRINCIPAL_TYPE,
  createPersonaPrincipalContext,
} from '../src/modules/auth/personaPrincipalContext.js';

describe('personaPrincipalContext — createPersonaPrincipalContext', () => {
  const mockUser = {
    _id: '64f0000000000000000000ab',
    clerkId: 'user_2abcDEF1234567890',
    email: 'raiyan@example.com',
    name: 'Raiyan',
    role: 'normal',
  };

  it('always sets domain to the fixed PERSONA_DOMAIN constant', () => {
    const context = createPersonaPrincipalContext(mockUser);
    expect(context.domain).toBe(PERSONA_DOMAIN);
    expect(context.domain).toBe('persona');
  });

  it('sets principalType to PersonaUser', () => {
    const context = createPersonaPrincipalContext(mockUser);
    expect(context.principalType).toBe(PRINCIPAL_TYPE.PERSONA_USER);
    expect(context.principalType).toBe('PersonaUser');
  });

  it('uses the internal Mongo _id as personaUserId, never the Clerk id', () => {
    const context = createPersonaPrincipalContext(mockUser);
    expect(context.personaUserId).toBe(mockUser._id);
    expect(context.personaUserId).not.toBe(mockUser.clerkId);
  });

  it('falls back to the Mongoose virtual "id" getter if "_id" is absent', () => {
    const userWithVirtualId = { id: '64f0000000000000000000cd', clerkId: 'user_xyz' };
    const context = createPersonaPrincipalContext(userWithVirtualId);
    expect(context.personaUserId).toBe('64f0000000000000000000cd');
  });

  it('prefers _id over id when both are present', () => {
    const userWithBoth = { _id: 'mongo-id', id: 'virtual-id', clerkId: 'user_xyz' };
    const context = createPersonaPrincipalContext(userWithBoth);
    expect(context.personaUserId).toBe('mongo-id');
  });

  it.each([undefined, null, {}, { clerkId: 'user_xyz' }])(
    'throws for invalid/missing user input: %p',
    (badUser) => {
      expect(() => createPersonaPrincipalContext(badUser)).toThrow(
        /authenticated Persona User with an internal _id\/id is required/
      );
    }
  );

  it('returns only the three documented fields — no arbitrary request/user data leaks through', () => {
    const userWithExtraStuff = {
      _id: 'mongo-id',
      clerkId: 'user_xyz',
      email: 'raiyan@example.com',
      headers: { authorization: 'Bearer some-clerk-jwt' },
      role: 'admin',
      password: 'should-never-appear',
    };
    const context = createPersonaPrincipalContext(userWithExtraStuff);
    expect(Object.keys(context).sort()).toEqual(['domain', 'personaUserId', 'principalType']);
    expect(context).not.toHaveProperty('headers');
    expect(context).not.toHaveProperty('clerkId');
    expect(context).not.toHaveProperty('password');
  });

  it('does not accept or depend on a request object — only a user document', () => {
    // The factory's signature takes a user, not req; passing a request-shaped
    // object with no _id/id must still fail the same way any other invalid
    // input does, proving there is no hidden header/req-based code path.
    const fakeReq = { headers: { 'x-agent-id': 'abc' }, user: { _id: 'nested-id' } };
    expect(() => createPersonaPrincipalContext(fakeReq)).toThrow(
      /authenticated Persona User with an internal _id\/id is required/
    );
  });

  it('returns a frozen (immutable) context object', () => {
    const context = createPersonaPrincipalContext(mockUser);
    expect(Object.isFrozen(context)).toBe(true);
    // ES modules run in strict mode, so mutating a frozen object throws
    // rather than silently no-op-ing.
    expect(() => {
      context.domain = 'tampered';
    }).toThrow(TypeError);
    expect(context.domain).toBe(PERSONA_DOMAIN);
  });
});
