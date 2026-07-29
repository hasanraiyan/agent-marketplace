import { jest } from '@jest/globals';
import projectCredentialRepository from '../src/modules/projects/projectCredential.repository.js';
import ProjectCredential from '../src/modules/projects/projectCredential.model.js';

describe('ProjectCredential Repository', () => {
  const projectId = '507f1f77bcf86cd799439099';
  let mockCredential;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCredential = {
      _id: '507f1f77bcf86cd799439055',
      project: projectId,
      keyId: 'pk_abc123',
      secretHash: 'hashedvalue',
      label: 'production',
      status: 'ACTIVE',
      createdBy: '507f1f77bcf86cd799439011',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      save: jest.fn(),
    };
    mockCredential.save.mockResolvedValue(mockCredential);
  });

  describe('create', () => {
    test('creates a credential via save()', async () => {
      const saveSpy = jest
        .spyOn(ProjectCredential.prototype, 'save')
        .mockResolvedValue(mockCredential);

      const result = await projectCredentialRepository.create({
        project: projectId,
        keyId: 'pk_abc123',
        secretHash: 'hashedvalue',
        createdBy: '507f1f77bcf86cd799439011',
      });

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockCredential);
    });
  });

  describe('findByKeyId', () => {
    test('finds a credential by its public keyId', async () => {
      jest.spyOn(ProjectCredential, 'findOne').mockResolvedValue(mockCredential);

      const result = await projectCredentialRepository.findByKeyId('pk_abc123');

      expect(ProjectCredential.findOne).toHaveBeenCalledWith({ keyId: 'pk_abc123' });
      expect(result).toEqual(mockCredential);
    });
  });

  describe('findByProjectAndId', () => {
    test('finds a credential scoped to its own Project', async () => {
      jest.spyOn(ProjectCredential, 'findOne').mockResolvedValue(mockCredential);

      const result = await projectCredentialRepository.findByProjectAndId(
        projectId,
        mockCredential._id
      );

      expect(ProjectCredential.findOne).toHaveBeenCalledWith({
        _id: mockCredential._id,
        project: projectId,
      });
      expect(result).toEqual(mockCredential);
    });
  });

  describe('findByProject', () => {
    test('lists credentials for a Project, oldest first', async () => {
      jest.spyOn(ProjectCredential, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockCredential]),
      });

      const result = await projectCredentialRepository.findByProject(projectId);

      expect(ProjectCredential.find).toHaveBeenCalledWith({ project: projectId });
      expect(result).toEqual([mockCredential]);
    });
  });

  describe('touchLastUsedAt', () => {
    test('sets lastUsedAt to the given (or default) timestamp', async () => {
      jest.spyOn(ProjectCredential, 'findByIdAndUpdate').mockResolvedValue(mockCredential);
      const when = new Date('2026-01-01T00:00:00Z');

      await projectCredentialRepository.touchLastUsedAt(mockCredential._id, when);

      expect(ProjectCredential.findByIdAndUpdate).toHaveBeenCalledWith(mockCredential._id, {
        $set: { lastUsedAt: when },
      });
    });
  });

  describe('revoke', () => {
    test('revokes only a currently-ACTIVE credential (atomic guard)', async () => {
      const revoked = { ...mockCredential, status: 'REVOKED', revokedAt: expect.any(Date) };
      jest.spyOn(ProjectCredential, 'findOneAndUpdate').mockResolvedValue(revoked);

      const result = await projectCredentialRepository.revoke(mockCredential._id);

      expect(ProjectCredential.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockCredential._id, status: 'ACTIVE' },
        { $set: { status: 'REVOKED', revokedAt: expect.any(Date) } },
        { new: true }
      );
      expect(result.status).toBe('REVOKED');
    });

    test('returns null (no-op) when the credential is already revoked', async () => {
      jest.spyOn(ProjectCredential, 'findOneAndUpdate').mockResolvedValue(null);

      const result = await projectCredentialRepository.revoke(mockCredential._id);

      expect(result).toBeNull();
    });
  });

  describe('deleteAllByProject', () => {
    test('deletes every credential for a Project', async () => {
      jest.spyOn(ProjectCredential, 'deleteMany').mockResolvedValue({ deletedCount: 4 });

      const result = await projectCredentialRepository.deleteAllByProject(projectId);

      expect(ProjectCredential.deleteMany).toHaveBeenCalledWith({ project: projectId });
      expect(result.deletedCount).toBe(4);
    });
  });
});
