import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: {
    create: jest.fn(),
    findByClerkId: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectInvitation.service.js', () => ({
  default: {
    backfillCreatedInvitation: jest.fn(),
    handleInvitationAccepted: jest.fn(),
    handleInvitationRevoked: jest.fn(),
    resolvePendingForEmail: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectInvitation.repository.js', () => ({
  default: {
    findByClerkInvitationId: jest.fn(),
    markRevoked: jest.fn(),
  },
}));

const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const projectInvitationService = (
  await import('../src/modules/projects/projectInvitation.service.js')
).default;
const projectInvitationRepository = (
  await import('../src/modules/projects/projectInvitation.repository.js')
).default;
const webhookService = (await import('../src/modules/webhooks/webhook.service.js')).default;

describe('Webhook Service — invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser (user.created)', () => {
    test('resolves pending invitations for the new user email', async () => {
      const createdUser = {
        _id: '507f1f77bcf86cd799439022',
        clerkId: 'user_2new',
        email: 'new@beyond.campus',
      };
      userRepository.create.mockResolvedValue(createdUser);

      await webhookService.createUser({
        id: 'user_2new',
        email_addresses: [{ email_address: 'new@beyond.campus' }],
        first_name: 'New',
        last_name: 'Admin',
      });

      expect(projectInvitationService.resolvePendingForEmail).toHaveBeenCalledWith(
        'new@beyond.campus',
        createdUser._id
      );
    });

    test('resolves pending invitations even when the user row already existed', async () => {
      userRepository.create.mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
      );
      userRepository.findByEmail.mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
      });

      await webhookService.createUser({
        id: 'user_2existing',
        email_addresses: [{ email_address: 'existing@beyond.campus' }],
      });

      expect(projectInvitationService.resolvePendingForEmail).toHaveBeenCalledWith(
        'existing@beyond.campus',
        '507f1f77bcf86cd799439022'
      );
    });

    test('never fails user creation when invitation resolution errors', async () => {
      userRepository.create.mockResolvedValue({ _id: 'u1' });
      projectInvitationService.resolvePendingForEmail.mockRejectedValue(new Error('db down'));

      await expect(
        webhookService.createUser({
          id: 'user_2x',
          email_addresses: [{ email_address: 'x@beyond.campus' }],
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('invitation webhook delegation', () => {
    test('invitation.created → backfillCreatedInvitation', async () => {
      const payload = { id: 'inv_1', email_address: 'a@b.c' };
      await webhookService.handleInvitationCreated(payload);
      expect(projectInvitationService.backfillCreatedInvitation).toHaveBeenCalledWith(payload);
    });

    test('invitation.accepted → handleInvitationAccepted', async () => {
      const payload = { id: 'inv_1', email_address: 'a@b.c' };
      await webhookService.handleInvitationAccepted(payload);
      expect(projectInvitationService.handleInvitationAccepted).toHaveBeenCalledWith(payload);
    });

    test('invitation.revoked → handleInvitationRevoked', async () => {
      const payload = { id: 'inv_1' };
      await webhookService.handleInvitationRevoked(payload);
      expect(projectInvitationService.handleInvitationRevoked).toHaveBeenCalledWith(payload);
    });

    test('propagates failures to the caller (webhook controller returns 500)', async () => {
      projectInvitationService.handleInvitationAccepted.mockRejectedValue(new Error('boom'));

      await expect(webhookService.handleInvitationAccepted({ id: 'inv_1' })).rejects.toThrow(
        'boom'
      );
    });
  });
});
