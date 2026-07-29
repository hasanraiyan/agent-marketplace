import { jest } from '@jest/globals';
import externalUserRepository from '../src/modules/externalUsers/externalUser.repository.js';
import ExternalUser from '../src/modules/externalUsers/externalUser.model.js';

describe('ExternalUser Repository', () => {
  const beyondCampusId = '507f1f77bcf86cd799439099';
  const coursifyId = '507f1f77bcf86cd799439088';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveOrCreate', () => {
    test('performs a single atomic upsert keyed by (project, externalUserId)', async () => {
      const resolved = {
        _id: '507f1f77bcf86cd799439011',
        project: beyondCampusId,
        externalUserId: 'rahul',
        lastSeenAt: expect.any(Date),
      };
      jest.spyOn(ExternalUser, 'findOneAndUpdate').mockResolvedValue(resolved);

      const result = await externalUserRepository.resolveOrCreate(beyondCampusId, 'rahul');

      expect(ExternalUser.findOneAndUpdate).toHaveBeenCalledWith(
        { project: beyondCampusId, externalUserId: 'rahul' },
        {
          $set: { lastSeenAt: expect.any(Date) },
          $setOnInsert: { project: beyondCampusId, externalUserId: 'rahul' },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      expect(result).toEqual(resolved);
    });

    test('includes only explicitly-supplied metadata fields in $set — omitted fields are never cleared', async () => {
      jest.spyOn(ExternalUser, 'findOneAndUpdate').mockResolvedValue({});

      await externalUserRepository.resolveOrCreate(beyondCampusId, 'sabik', {
        displayName: 'Sabik',
      });

      expect(ExternalUser.findOneAndUpdate).toHaveBeenCalledWith(
        { project: beyondCampusId, externalUserId: 'sabik' },
        {
          $set: { lastSeenAt: expect.any(Date), displayName: 'Sabik' },
          $setOnInsert: { project: beyondCampusId, externalUserId: 'sabik' },
        },
        expect.any(Object)
      );
    });

    test('applies all supplied metadata fields together', async () => {
      jest.spyOn(ExternalUser, 'findOneAndUpdate').mockResolvedValue({});

      await externalUserRepository.resolveOrCreate(beyondCampusId, 'aman', {
        displayName: 'Aman',
        email: 'aman@example.com',
        avatarUrl: 'https://example.com/aman.png',
      });

      expect(ExternalUser.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            displayName: 'Aman',
            email: 'aman@example.com',
            avatarUrl: 'https://example.com/aman.png',
          }),
        }),
        expect.any(Object)
      );
    });

    test('the same externalUserId under two different Projects targets two distinct queries', async () => {
      jest.spyOn(ExternalUser, 'findOneAndUpdate').mockResolvedValue({});

      await externalUserRepository.resolveOrCreate(beyondCampusId, 'rahul');
      await externalUserRepository.resolveOrCreate(coursifyId, 'rahul');

      expect(ExternalUser.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        { project: beyondCampusId, externalUserId: 'rahul' },
        expect.any(Object),
        expect.any(Object)
      );
      expect(ExternalUser.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { project: coursifyId, externalUserId: 'rahul' },
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('findByProjectAndExternalUserId', () => {
    test('looks up by the compound key', async () => {
      const doc = { project: beyondCampusId, externalUserId: 'rahul' };
      jest.spyOn(ExternalUser, 'findOne').mockResolvedValue(doc);

      const result = await externalUserRepository.findByProjectAndExternalUserId(
        beyondCampusId,
        'rahul'
      );

      expect(ExternalUser.findOne).toHaveBeenCalledWith({
        project: beyondCampusId,
        externalUserId: 'rahul',
      });
      expect(result).toEqual(doc);
    });

    test('returns null when no record exists', async () => {
      jest.spyOn(ExternalUser, 'findOne').mockResolvedValue(null);

      const result = await externalUserRepository.findByProjectAndExternalUserId(
        beyondCampusId,
        'nobody'
      );

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    test('lists external users for a Project, oldest first', async () => {
      jest.spyOn(ExternalUser, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ externalUserId: 'rahul' }]),
      });

      const result = await externalUserRepository.findByProject(beyondCampusId);

      expect(ExternalUser.find).toHaveBeenCalledWith({ project: beyondCampusId });
      expect(result).toEqual([{ externalUserId: 'rahul' }]);
    });
  });

  describe('deleteAllByProject', () => {
    test('deletes every external user for a Project', async () => {
      jest.spyOn(ExternalUser, 'deleteMany').mockResolvedValue({ deletedCount: 3 });

      const result = await externalUserRepository.deleteAllByProject(beyondCampusId);

      expect(ExternalUser.deleteMany).toHaveBeenCalledWith({ project: beyondCampusId });
      expect(result.deletedCount).toBe(3);
    });
  });
});
