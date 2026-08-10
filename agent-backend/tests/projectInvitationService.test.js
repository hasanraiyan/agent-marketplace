import { jest } from '@jest/globals';

jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: {
    invitations: {
      createInvitation: jest.fn(),
      revokeInvitation: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../src/modules/projects/project.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/projects/projectInvitation.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByClerkInvitationId: jest.fn(),
    findPendingByProjectAndEmail: jest.fn(),
    findByProject: jest.fn(),
    findPendingByEmail: jest.fn(),
    markAccepted: jest.fn(),
    markRevoked: jest.fn(),
    markExpired: jest.fn(),
    markPendingExpiredBefore: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.service.js', () => ({
  default: { addMember: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: { findByProjectAndUser: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: { findByEmail: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: { record: jest.fn() },
}));

const clerkClient = (await import('@clerk/express')).clerkClient;
const projectRepository = (await import('../src/modules/projects/project.repository.js')).default;
const projectInvitationRepository = (
  await import('../src/modules/projects/projectInvitation.repository.js')
).default;
const projectMembershipService = (
  await import('../src/modules/projects/projectMembership.service.js')
).default;
const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;
const projectInvitationService = (
  await import('../src/modules/projects/projectInvitation.service.js')
).default;
const { default: NotFoundError } = await import('../src/utils/errors/NotFoundError.js');

describe('ProjectInvitation Service', () => {
  const projectId = '507f1f77bcf86cd799439099';
  const otherProjectId = '507f1f77bcf86cd799439088';
  const inviterId = '507f1f77bcf86cd799439011';
  const inviteeId = '507f1f77bcf86cd799439022';
  const email = 'new-admin@beyond.campus';
  const clerkInvitationId = 'inv_2abc123';

  const pendingInvitation = {
    _id: '507f1f77bcf86cd799439033',
    project: projectId,
    email,
    clerkInvitationId,
    role: 'Admin',
    status: 'pending',
    invitedBy: inviterId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    test('rejects when the email already maps to a Persona account', async () => {
      userRepository.findByEmail.mockResolvedValue({ _id: inviteeId });

      await expect(
        projectInvitationService.createInvitation(projectId, email, inviterId)
      ).rejects.toThrow('already has a Persona account');
      expect(clerkClient.invitations.createInvitation).not.toHaveBeenCalled();
    });

    test('creates a Clerk invitation + local row for an email with no account yet', async () => {
      userRepository.findByEmail.mockRejectedValue(new NotFoundError('not found'));
      projectInvitationRepository.findPendingByProjectAndEmail.mockResolvedValue(null);
      projectRepository.findById.mockResolvedValue({ _id: projectId });
      clerkClient.invitations.createInvitation.mockResolvedValue({ id: clerkInvitationId });
      projectInvitationRepository.create.mockResolvedValue(pendingInvitation);

      const result = await projectInvitationService.createInvitation(projectId, email, inviterId);

      expect(clerkClient.invitations.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAddress: email,
          publicMetadata: { projectId, role: 'Admin' },
          expiresInDays: 7,
          notify: true,
          redirectUrl: expect.stringContaining(
            `developer/invitations/accept?email=${encodeURIComponent(email)}`
          ),
        })
      );
      expect(projectInvitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project: projectId,
          email,
          clerkInvitationId,
          role: 'Admin',
          status: 'pending',
          invitedBy: inviterId,
        })
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'invitation.created' })
      );
      expect(result).toEqual(pendingInvitation);
    });

    test('is idempotent — reuses an existing pending invitation without calling Clerk', async () => {
      userRepository.findByEmail.mockRejectedValue(new NotFoundError('not found'));
      projectInvitationRepository.findPendingByProjectAndEmail.mockResolvedValue(pendingInvitation);

      const result = await projectInvitationService.createInvitation(projectId, email, inviterId);

      expect(clerkClient.invitations.createInvitation).not.toHaveBeenCalled();
      expect(result).toEqual(pendingInvitation);
    });

    test('survives the E11000 race — returns the concurrent winner', async () => {
      userRepository.findByEmail.mockRejectedValue(new NotFoundError('not found'));
      projectInvitationRepository.findPendingByProjectAndEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingInvitation);
      projectRepository.findById.mockResolvedValue({ _id: projectId });
      clerkClient.invitations.createInvitation.mockResolvedValue({ id: clerkInvitationId });
      projectInvitationRepository.create.mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
      );

      const result = await projectInvitationService.createInvitation(projectId, email, inviterId);

      expect(result).toEqual(pendingInvitation);
      expect(projectInvitationRepository.create).toHaveBeenCalledTimes(1);
    });

    test('stores an expiresAt mirroring the Clerk expiry window', async () => {
      userRepository.findByEmail.mockRejectedValue(new NotFoundError('not found'));
      projectInvitationRepository.findPendingByProjectAndEmail.mockResolvedValue(null);
      projectRepository.findById.mockResolvedValue({ _id: projectId });
      clerkClient.invitations.createInvitation.mockResolvedValue({ id: clerkInvitationId });
      projectInvitationRepository.create.mockImplementation(async (data) => data);

      const result = await projectInvitationService.createInvitation(projectId, email, inviterId);

      const expected = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(Math.abs(result.expiresAt - expected)).toBeLessThan(5000);
    });
  });

  describe('listInvitations', () => {
    test('delegates to the repository', async () => {
      projectInvitationRepository.findByProject.mockResolvedValue([pendingInvitation]);

      const result = await projectInvitationService.listInvitations(projectId);

      expect(projectInvitationRepository.findByProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual([pendingInvitation]);
    });

    test('lazily expires past-due pending invitations before listing', async () => {
      projectInvitationRepository.findByProject.mockResolvedValue([]);

      await projectInvitationService.listInvitations(projectId);

      expect(projectInvitationRepository.markPendingExpiredBefore).toHaveBeenCalled();
    });
  });

  describe('revokeInvitation', () => {
    test('404s when the invitation is missing or belongs to another Project', async () => {
      projectInvitationRepository.findById.mockResolvedValue({
        ...pendingInvitation,
        project: otherProjectId,
      });

      await expect(
        projectInvitationService.revokeInvitation(projectId, pendingInvitation._id, inviterId)
      ).rejects.toThrow('Invitation not found');
    });

    test('rejects revoking a non-pending invitation without touching Clerk', async () => {
      projectInvitationRepository.findById.mockResolvedValue({
        ...pendingInvitation,
        status: 'accepted',
      });

      await expect(
        projectInvitationService.revokeInvitation(projectId, pendingInvitation._id, inviterId)
      ).rejects.toThrow('Cannot revoke a accepted invitation');
      expect(clerkClient.invitations.revokeInvitation).not.toHaveBeenCalled();
    });

    test('revokes in Clerk then marks the local row revoked', async () => {
      projectInvitationRepository.findById.mockResolvedValue(pendingInvitation);
      clerkClient.invitations.revokeInvitation.mockResolvedValue({ id: clerkInvitationId });
      projectInvitationRepository.markRevoked.mockResolvedValue({
        ...pendingInvitation,
        status: 'revoked',
      });

      const result = await projectInvitationService.revokeInvitation(
        projectId,
        pendingInvitation._id,
        inviterId
      );

      expect(clerkClient.invitations.revokeInvitation).toHaveBeenCalledWith(clerkInvitationId);
      expect(projectInvitationRepository.markRevoked).toHaveBeenCalledWith(pendingInvitation._id);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'invitation.revoked' })
      );
      expect(result.status).toBe('revoked');
    });
  });

  describe('handleInvitationAccepted (webhook)', () => {
    test('grants the Admin membership and marks the invitation accepted', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);
      userRepository.findByEmail.mockResolvedValue({ _id: inviteeId, email });
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);
      projectMembershipService.addMember.mockResolvedValue({});
      projectInvitationRepository.markAccepted.mockResolvedValue({
        ...pendingInvitation,
        status: 'accepted',
      });

      await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(projectMembershipService.addMember).toHaveBeenCalledWith(
        projectId,
        inviteeId,
        'Admin',
        inviteeId
      );
      expect(projectInvitationRepository.markAccepted).toHaveBeenCalledWith(
        pendingInvitation._id,
        inviteeId
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'invitation.accepted' })
      );
    });

    test('tolerates an already-existing membership (still accepts the invitation)', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);
      userRepository.findByEmail.mockResolvedValue({ _id: inviteeId, email });
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
        project: projectId,
        personaUserId: inviteeId,
        role: 'Admin',
      });
      projectInvitationRepository.markAccepted.mockResolvedValue({ status: 'accepted' });

      await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(projectInvitationRepository.markAccepted).toHaveBeenCalled();
    });

    test('defers when the local user row has not landed yet (webhook ordering)', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);
      userRepository.findByEmail.mockRejectedValue(new NotFoundError('not found'));

      const result = await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(result).toBeNull();
      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(projectInvitationRepository.markAccepted).not.toHaveBeenCalled();
    });

    test('no-ops for a revoked or expired invitation (redelivery guard)', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue({
        ...pendingInvitation,
        status: 'revoked',
      });

      const result = await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(result).toBeNull();
      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(projectInvitationRepository.markAccepted).not.toHaveBeenCalled();
    });

    test('is idempotent under race — tolerates addMember already-a-member error', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);
      userRepository.findByEmail.mockResolvedValue({ _id: inviteeId, email });
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);
      projectMembershipService.addMember.mockRejectedValue(
        new (await import('../src/utils/errors/ValidationError.js')).default(
          'User is already a member of this Project'
        )
      );
      projectInvitationRepository.markAccepted.mockResolvedValue({ status: 'accepted' });

      const result = await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(result).not.toBeNull();
      expect(projectInvitationRepository.markAccepted).toHaveBeenCalled();
    });

    test('returns null for an unknown invitation', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(null);
      projectInvitationRepository.findPendingByProjectAndEmail.mockResolvedValue(null);

      const result = await projectInvitationService.handleInvitationAccepted({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(result).toBeNull();
    });
  });

  describe('resolvePendingForEmail (user.created fallback)', () => {
    test('grants membership for every pending invitation on that email', async () => {
      const second = { ...pendingInvitation, _id: 'inv2', project: otherProjectId };
      projectInvitationRepository.findPendingByEmail.mockResolvedValue([pendingInvitation, second]);
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);
      projectMembershipService.addMember.mockResolvedValue({});
      projectInvitationRepository.markAccepted.mockResolvedValue({ status: 'accepted' });

      await projectInvitationService.resolvePendingForEmail(email, inviteeId);

      expect(projectMembershipService.addMember).toHaveBeenCalledTimes(2);
      expect(projectInvitationRepository.markAccepted).toHaveBeenCalledTimes(2);
    });

    test('never throws — logs and continues on a per-invitation failure', async () => {
      projectInvitationRepository.findPendingByEmail.mockResolvedValue([pendingInvitation]);
      projectMembershipRepository.findByProjectAndUser.mockRejectedValue(new Error('db down'));

      await expect(
        projectInvitationService.resolvePendingForEmail(email, inviteeId)
      ).resolves.toBeUndefined();
    });
  });

  describe('backfillCreatedInvitation (orphan healing)', () => {
    test('no-ops when the local row already exists', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);

      const result = await projectInvitationService.backfillCreatedInvitation({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId },
      });

      expect(projectInvitationRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(pendingInvitation);
    });

    test('creates the row when the Clerk invite has no local row yet', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(null);
      projectInvitationRepository.create.mockResolvedValue(pendingInvitation);

      const result = await projectInvitationService.backfillCreatedInvitation({
        id: clerkInvitationId,
        email_address: email,
        public_metadata: { projectId, role: 'Admin' },
        expires_at: '2026-08-20T00:00:00.000Z',
      });

      expect(projectInvitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project: projectId,
          email,
          clerkInvitationId,
          status: 'pending',
          expiresAt: new Date('2026-08-20T00:00:00.000Z'),
        })
      );
      expect(result).toEqual(pendingInvitation);
    });
  });

  describe('handleInvitationRevoked (webhook)', () => {
    test('marks a pending invitation revoked', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue(pendingInvitation);
      projectInvitationRepository.markRevoked.mockResolvedValue({
        ...pendingInvitation,
        status: 'revoked',
      });

      const result = await projectInvitationService.handleInvitationRevoked({
        id: clerkInvitationId,
      });

      expect(projectInvitationRepository.markRevoked).toHaveBeenCalledWith(pendingInvitation._id);
      expect(result.status).toBe('revoked');
    });

    test('no-ops for non-pending invitations', async () => {
      projectInvitationRepository.findByClerkInvitationId.mockResolvedValue({
        ...pendingInvitation,
        status: 'accepted',
      });

      const result = await projectInvitationService.handleInvitationRevoked({
        id: clerkInvitationId,
      });

      expect(projectInvitationRepository.markRevoked).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
