import { jest } from '@jest/globals';
import projectInvitationRepository from '../src/modules/projects/projectInvitation.repository.js';
import ProjectInvitation from '../src/modules/projects/projectInvitation.model.js';

describe('ProjectInvitation Repository', () => {
  const projectId = '507f1f77bcf86cd799439099';
  const email = 'new-admin@beyond.campus';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findPendingByEmail', () => {
    test('returns all pending invitations for an email (user.created fallback)', async () => {
      const pending = [{ email, status: 'pending' }];
      jest.spyOn(ProjectInvitation, 'find').mockResolvedValue(pending);

      const result = await projectInvitationRepository.findPendingByEmail(email);

      expect(ProjectInvitation.find).toHaveBeenCalledWith({
        email,
        status: 'pending',
      });
      expect(result).toEqual(pending);
    });
  });

  describe('markExpired', () => {
    test('flips a single invitation to expired', async () => {
      const expired = { _id: 'inv1', status: 'expired' };
      jest.spyOn(ProjectInvitation, 'findByIdAndUpdate').mockResolvedValue(expired);

      const result = await projectInvitationRepository.markExpired('inv1');

      expect(ProjectInvitation.findByIdAndUpdate).toHaveBeenCalledWith(
        'inv1',
        { status: 'expired' },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(expired);
    });
  });

  describe('markPendingExpiredBefore', () => {
    test('expires every past-due pending invitation', async () => {
      const now = new Date('2026-08-10T00:00:00.000Z');
      jest.spyOn(ProjectInvitation, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      const count = await projectInvitationRepository.markPendingExpiredBefore(now);

      expect(ProjectInvitation.updateMany).toHaveBeenCalledWith(
        { status: 'pending', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      );
      expect(count).toBe(2);
    });

    test('defaults to the current time', async () => {
      jest.spyOn(ProjectInvitation, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

      await projectInvitationRepository.markPendingExpiredBefore();

      const [filter] = ProjectInvitation.updateMany.mock.calls[0];
      expect(filter.status).toBe('pending');
      expect(filter.expiresAt.$lte).toBeInstanceOf(Date);
    });

    test('returns 0 when updateMany reports no modification count', async () => {
      jest.spyOn(ProjectInvitation, 'updateMany').mockResolvedValue({});

      const count = await projectInvitationRepository.markPendingExpiredBefore();

      expect(count).toBe(0);
    });
  });
});
