import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectCredential.service.js', () => ({
  default: {
    verifyCredential: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    getProjectById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: {
    resolveOrCreate: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const { default: developerMachineAuthMiddleware, parseProjectCredential } =
  await import('../src/modules/auth/developerMachineAuth.middleware.js');

describe('parseProjectCredential', () => {
  it('parses a well-formed Bearer <keyId>.<secret> header', () => {
    const result = parseProjectCredential('Bearer pk_abc123.the-secret-value');
    expect(result).toEqual({ keyId: 'pk_abc123', secret: 'the-secret-value' });
  });

  it.each([
    [undefined],
    [''],
    ['pk_abc123.secret'], // missing "Bearer " prefix
    ['Bearer '], // empty token
    ['Bearer pk_abc123'], // no separator
    ['Bearer .secret'], // empty keyId
    ['Bearer pk_abc123.'], // empty secret
  ])('returns null for a malformed or missing header: %p', (header) => {
    expect(parseProjectCredential(header)).toBeNull();
  });
});

describe('developerMachineAuthMiddleware', () => {
  let req, res, next;
  const projectId = '507f1f77bcf86cd799439099';
  const credentialId = '507f1f77bcf86cd799439055';

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: { authorization: 'Bearer pk_abc123.the-secret-value' } };
    res = {};
    next = jest.fn();
  });

  it('attaches a ProjectMachineContext and calls next() with no error on a valid, ACTIVE-project credential', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    projectService.getProjectById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });

    await developerMachineAuthMiddleware(req, res, next);

    expect(projectCredentialService.verifyCredential).toHaveBeenCalledWith(
      'pk_abc123',
      'the-secret-value'
    );
    expect(req.projectContext).toEqual({
      domain: projectId,
      principalType: 'ProjectMachine',
      credentialId,
    });
    expect(next).toHaveBeenCalledWith(); // no error argument
  });

  it('never leaks the raw secret into the constructed context', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    projectService.getProjectById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });

    await developerMachineAuthMiddleware(req, res, next);

    expect(JSON.stringify(req.projectContext)).not.toContain('the-secret-value');
  });

  it('rejects with 401 when no Authorization header is present', async () => {
    req.headers = {};

    await developerMachineAuthMiddleware(req, res, next);

    expect(projectCredentialService.verifyCredential).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'A valid Project credential is required',
      })
    );
    expect(req.projectContext).toBeUndefined();
  });

  it('rejects with 401 for a malformed credential (no separator)', async () => {
    req.headers.authorization = 'Bearer not-a-valid-credential';

    await developerMachineAuthMiddleware(req, res, next);

    expect(projectCredentialService.verifyCredential).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects with 401 when the credential fails verification (unknown key or wrong secret)', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue(null);

    await developerMachineAuthMiddleware(req, res, next);

    expect(projectService.getProjectById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Invalid Project credential' })
    );
    expect(req.projectContext).toBeUndefined();
  });

  it.each(['SUSPENDED', 'DELETING', 'DELETED'])(
    'rejects with 403 when the Project status is %s',
    async (status) => {
      projectCredentialService.verifyCredential.mockResolvedValue({
        credentialId,
        project: projectId,
      });
      projectService.getProjectById.mockResolvedValue({ _id: projectId, status });

      await developerMachineAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403, code: 'PROJECT_NOT_ACTIVE' })
      );
      expect(req.projectContext).toBeUndefined();
    }
  );

  it('checks Project status only after the credential itself has already been verified', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue(null);

    await developerMachineAuthMiddleware(req, res, next);

    // An invalid credential must never trigger a Project lookup at all —
    // proves the validation order (credential validity -> Project status).
    expect(projectService.getProjectById).not.toHaveBeenCalled();
  });

  it('resolves-or-creates the external user and attaches a ProjectRuntimeContext when the externalUserId header is present on an otherwise valid, ACTIVE-project credential', async () => {
    req.headers['x-persona-external-user-id'] = 'sabik';
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    projectService.getProjectById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });
    externalUserService.resolveOrCreate.mockResolvedValue({
      _id: 'external-user-doc-id',
      project: projectId,
      externalUserId: 'sabik',
    });

    await developerMachineAuthMiddleware(req, res, next);

    expect(externalUserService.resolveOrCreate).toHaveBeenCalledWith(projectId, 'sabik');
    expect(req.projectContext).toEqual({
      domain: projectId,
      principalType: 'ProjectRuntime',
      credentialId,
      externalUserId: 'sabik',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("builds ProjectRuntimeContext from the raw header value, not the resolved ExternalUser record's internal _id", async () => {
    req.headers['x-persona-external-user-id'] = 'sabik';
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    projectService.getProjectById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });
    externalUserService.resolveOrCreate.mockResolvedValue({
      _id: 'some-internal-mongo-id-never-exposed',
      project: projectId,
      externalUserId: 'sabik',
    });

    await developerMachineAuthMiddleware(req, res, next);

    expect(req.projectContext.externalUserId).toBe('sabik');
    expect(JSON.stringify(req.projectContext)).not.toContain(
      'some-internal-mongo-id-never-exposed'
    );
  });

  it('does not evaluate the externalUserId header until after authentication and status checks succeed', async () => {
    // An unauthenticated caller must not learn anything about feature
    // availability before proving who they are.
    req.headers['x-persona-external-user-id'] = 'sabik';
    projectCredentialService.verifyCredential.mockResolvedValue(null);

    await developerMachineAuthMiddleware(req, res, next);

    expect(externalUserService.resolveOrCreate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Invalid Project credential' })
    );
  });

  it('propagates a failure from resolveOrCreate to next() rather than throwing', async () => {
    req.headers['x-persona-external-user-id'] = 'sabik';
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    projectService.getProjectById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });
    const resolveError = new Error('database unavailable');
    externalUserService.resolveOrCreate.mockRejectedValue(resolveError);

    await developerMachineAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(resolveError);
    expect(req.projectContext).toBeUndefined();
  });

  it('propagates unexpected errors (e.g. Project lookup failure) to next() rather than throwing', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId,
      project: projectId,
    });
    const lookupError = new Error('Project not found');
    projectService.getProjectById.mockRejectedValue(lookupError);

    await developerMachineAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(lookupError);
  });
});
