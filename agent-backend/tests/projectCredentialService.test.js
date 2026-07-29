import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectCredential.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByKeyId: jest.fn(),
    findByProjectAndId: jest.fn(),
    findByProject: jest.fn(),
    touchLastUsedAt: jest.fn(),
    revoke: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/credentialSecret.js', () => ({
  default: {
    generateKeyId: jest.fn(),
    generateSecret: jest.fn(),
    hashSecret: jest.fn(),
    verifySecret: jest.fn(),
  },
}));

const projectCredentialRepository = (
  await import('../src/modules/projects/projectCredential.repository.js')
).default;
const credentialSecret = (await import('../src/utils/credentialSecret.js')).default;
const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;

describe('ProjectCredential Service', () => {
  const projectId = '507f1f77bcf86cd799439099';
  const otherProjectId = '507f1f77bcf86cd799439088';
  const raiyanId = '507f1f77bcf86cd799439011';
  const credentialId = '507f1f77bcf86cd799439055';

  const adminContext = {
    domain: projectId,
    principalType: 'ProjectAdmin',
    personaUserId: raiyanId,
    membershipRole: 'Admin',
  };
  const machineContext = { domain: projectId, principalType: 'ProjectMachine', credentialId };
  const runtimeContext = {
    domain: projectId,
    principalType: 'ProjectRuntime',
    credentialId,
    externalUserId: 'sabik',
  };

  let mockCredentialDoc;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCredentialDoc = {
      _id: credentialId,
      project: projectId,
      keyId: 'pk_generated123',
      secretHash: 'hashed-secret-value',
      label: 'production',
      status: 'ACTIVE',
      createdBy: raiyanId,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
  });

  describe('createCredential — AD-08 §17 authority', () => {
    test('succeeds for ProjectAdminContext and returns the plaintext secret exactly once', async () => {
      credentialSecret.generateKeyId.mockReturnValue('pk_generated123');
      credentialSecret.generateSecret.mockReturnValue('raw-plaintext-secret');
      credentialSecret.hashSecret.mockReturnValue('hashed-secret-value');
      projectCredentialRepository.create.mockResolvedValue(mockCredentialDoc);

      const result = await projectCredentialService.createCredential(adminContext, {
        label: 'production',
      });

      expect(projectCredentialRepository.create).toHaveBeenCalledWith({
        project: projectId,
        keyId: 'pk_generated123',
        secretHash: 'hashed-secret-value',
        label: 'production',
        createdBy: raiyanId,
      });
      expect(result.secret).toBe('raw-plaintext-secret');
      expect(result.keyId).toBe('pk_generated123');
      expect(result).not.toHaveProperty('secretHash');
    });

    test('derives the Project from adminContext.domain, never from a separate parameter', async () => {
      credentialSecret.generateKeyId.mockReturnValue('pk_x');
      credentialSecret.generateSecret.mockReturnValue('secret-x');
      credentialSecret.hashSecret.mockReturnValue('hash-x');
      projectCredentialRepository.create.mockResolvedValue(mockCredentialDoc);

      await projectCredentialService.createCredential(adminContext, {
        label: 'x',
        // @ts-expect-error attempting to smuggle a different project
        project: otherProjectId,
      });

      expect(projectCredentialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ project: projectId })
      );
    });

    test('rejects ProjectMachineContext — a machine credential must never mint another credential', async () => {
      await expect(
        projectCredentialService.createCredential(machineContext, { label: 'x' })
      ).rejects.toThrow(/Only ProjectAdminContext may create/);
      expect(projectCredentialRepository.create).not.toHaveBeenCalled();
    });

    test('rejects ProjectRuntimeContext', async () => {
      await expect(
        projectCredentialService.createCredential(runtimeContext, { label: 'x' })
      ).rejects.toThrow(/Only ProjectAdminContext may create/);
    });

    test('rejects a missing/undefined context', async () => {
      await expect(projectCredentialService.createCredential(undefined, {})).rejects.toThrow(
        /Only ProjectAdminContext may create/
      );
    });
  });

  describe('revokeCredential — AD-08 §17 authority', () => {
    test('Admin may revoke any credential belonging to its own Project', async () => {
      projectCredentialRepository.findByProjectAndId.mockResolvedValue(mockCredentialDoc);
      projectCredentialRepository.revoke.mockResolvedValue({
        ...mockCredentialDoc,
        status: 'REVOKED',
      });

      const result = await projectCredentialService.revokeCredential(adminContext, credentialId);

      expect(projectCredentialRepository.findByProjectAndId).toHaveBeenCalledWith(
        projectId,
        credentialId
      );
      expect(projectCredentialRepository.revoke).toHaveBeenCalledWith(credentialId);
      expect(result.status).toBe('REVOKED');
    });

    test('a machine credential may revoke itself', async () => {
      projectCredentialRepository.findByProjectAndId.mockResolvedValue(mockCredentialDoc);
      projectCredentialRepository.revoke.mockResolvedValue({
        ...mockCredentialDoc,
        status: 'REVOKED',
      });

      // machineContext.credentialId === credentialId (self)
      const result = await projectCredentialService.revokeCredential(machineContext, credentialId);

      expect(projectCredentialRepository.revoke).toHaveBeenCalledWith(credentialId);
      expect(result.status).toBe('REVOKED');
    });

    test('a machine credential may NOT revoke a different credential', async () => {
      const differentCredentialId = '507f1f77bcf86cd799439066';

      await expect(
        projectCredentialService.revokeCredential(machineContext, differentCredentialId)
      ).rejects.toThrow(/may only revoke itself/);
      expect(projectCredentialRepository.revoke).not.toHaveBeenCalled();
    });

    test('a runtime context may never revoke any credential', async () => {
      await expect(
        projectCredentialService.revokeCredential(runtimeContext, credentialId)
      ).rejects.toThrow(/Only ProjectAdminContext may revoke/);
      expect(projectCredentialRepository.revoke).not.toHaveBeenCalled();
    });

    test("throws NotFoundError when the credential does not belong to the caller's own Project", async () => {
      // findByProjectAndId is itself Domain-scoped — a credential from a
      // different Project simply won't be found under this admin's domain.
      projectCredentialRepository.findByProjectAndId.mockResolvedValue(null);

      await expect(
        projectCredentialService.revokeCredential(adminContext, credentialId)
      ).rejects.toThrow('Project credential not found');
      expect(projectCredentialRepository.revoke).not.toHaveBeenCalled();
    });

    test('is idempotent — revoking an already-revoked credential returns it without erroring', async () => {
      const alreadyRevoked = { ...mockCredentialDoc, status: 'REVOKED', revokedAt: new Date() };
      projectCredentialRepository.findByProjectAndId.mockResolvedValue(alreadyRevoked);
      projectCredentialRepository.revoke.mockResolvedValue(null); // atomic ACTIVE-only guard no-ops

      const result = await projectCredentialService.revokeCredential(adminContext, credentialId);

      expect(result.status).toBe('REVOKED');
    });
  });

  describe('listCredentials', () => {
    test('never includes secretHash in the returned metadata', async () => {
      projectCredentialRepository.findByProject.mockResolvedValue([mockCredentialDoc]);

      const result = await projectCredentialService.listCredentials(adminContext);

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('secretHash');
      expect(result[0].keyId).toBe('pk_generated123');
    });

    test('is permitted for ProjectMachineContext too (routine, read-only)', async () => {
      projectCredentialRepository.findByProject.mockResolvedValue([mockCredentialDoc]);

      const result = await projectCredentialService.listCredentials(machineContext);

      expect(projectCredentialRepository.findByProject).toHaveBeenCalledWith(projectId);
      expect(result).toHaveLength(1);
    });
  });

  describe('verifyCredential', () => {
    test('returns credentialId + project on a valid (keyId, secret) pair', async () => {
      projectCredentialRepository.findByKeyId.mockResolvedValue(mockCredentialDoc);
      credentialSecret.verifySecret.mockReturnValue(true);
      projectCredentialRepository.touchLastUsedAt.mockResolvedValue(mockCredentialDoc);

      const result = await projectCredentialService.verifyCredential(
        'pk_generated123',
        'the-correct-secret'
      );

      expect(result).toEqual({ credentialId, project: projectId });
      expect(projectCredentialRepository.touchLastUsedAt).toHaveBeenCalledWith(credentialId);
    });

    test('returns null for an unknown keyId', async () => {
      projectCredentialRepository.findByKeyId.mockResolvedValue(null);

      const result = await projectCredentialService.verifyCredential('pk_unknown', 'anything');

      expect(result).toBeNull();
      expect(credentialSecret.verifySecret).not.toHaveBeenCalled();
    });

    test('returns null for a wrong secret against a known keyId', async () => {
      projectCredentialRepository.findByKeyId.mockResolvedValue(mockCredentialDoc);
      credentialSecret.verifySecret.mockReturnValue(false);

      const result = await projectCredentialService.verifyCredential(
        'pk_generated123',
        'wrong-secret'
      );

      expect(result).toBeNull();
      expect(projectCredentialRepository.touchLastUsedAt).not.toHaveBeenCalled();
    });

    test('returns null for a revoked credential even with the correct secret — same path as unknown keyId', async () => {
      projectCredentialRepository.findByKeyId.mockResolvedValue({
        ...mockCredentialDoc,
        status: 'REVOKED',
      });

      const result = await projectCredentialService.verifyCredential(
        'pk_generated123',
        'the-correct-secret'
      );

      expect(result).toBeNull();
      // Never even attempts secret comparison for a non-ACTIVE credential —
      // proving "unknown key" and "revoked key" are indistinguishable to a
      // caller (no enumeration oracle), not merely coincidentally both null.
      expect(credentialSecret.verifySecret).not.toHaveBeenCalled();
    });
  });
});
