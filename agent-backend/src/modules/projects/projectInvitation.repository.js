import ProjectInvitation, { INVITATION_STATUS } from './projectInvitation.model.js';

class ProjectInvitationRepository {
  async create(data) {
    const invitation = new ProjectInvitation(data);
    return await invitation.save();
  }

  async findById(id) {
    return await ProjectInvitation.findById(id);
  }

  async findByClerkInvitationId(clerkInvitationId) {
    return await ProjectInvitation.findOne({ clerkInvitationId });
  }

  async findPendingByProjectAndEmail(projectId, email) {
    return await ProjectInvitation.findOne({
      project: projectId,
      email,
      status: INVITATION_STATUS.PENDING,
    });
  }

  async findByProject(projectId) {
    return await ProjectInvitation.find({ project: projectId }).sort({ createdAt: -1 });
  }

  async findPendingByEmail(email) {
    return await ProjectInvitation.find({ email, status: INVITATION_STATUS.PENDING });
  }

  async markAccepted(id, personaUserId, acceptedAt = new Date()) {
    return await ProjectInvitation.findByIdAndUpdate(
      id,
      { status: INVITATION_STATUS.ACCEPTED, acceptedAt, acceptedBy: personaUserId },
      { returnDocument: 'after' }
    );
  }

  async markRevoked(id) {
    return await ProjectInvitation.findByIdAndUpdate(
      id,
      { status: INVITATION_STATUS.REVOKED },
      { returnDocument: 'after' }
    );
  }

  async markExpired(id) {
    return await ProjectInvitation.findByIdAndUpdate(
      id,
      { status: INVITATION_STATUS.EXPIRED },
      { returnDocument: 'after' }
    );
  }

  /**
   * Lazily expires every pending invitation whose expiresAt has passed
   * (Clerk fires no webhook on expiry). Returns the count flipped.
   */
  async markPendingExpiredBefore(now = new Date()) {
    const result = await ProjectInvitation.updateMany(
      { status: INVITATION_STATUS.PENDING, expiresAt: { $lte: now } },
      { $set: { status: INVITATION_STATUS.EXPIRED } }
    );
    return result.modifiedCount ?? 0;
  }
}

export default new ProjectInvitationRepository();
