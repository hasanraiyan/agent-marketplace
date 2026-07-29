import externalUserRepository from './externalUser.repository.js';

/**
 * ExternalUser service — AD-02's JIT identity resolution, mirroring
 * `authService.syncUser`'s find-or-create shape for a different identity
 * source (a Project's own asserted external user, not Clerk).
 *
 * Not yet called by any middleware — see the master implementation
 * blueprint §11, §34 Phase 5. The future Developer auth middleware will
 * call `resolveOrCreate` when constructing `ProjectRuntimeContext`, but
 * `ProjectRuntimeContext.externalUserId` remains the raw asserted string
 * (AD-07 §8) — this service's internal record is a stable anchor for
 * future resource-ownership references, not a replacement identity.
 */
class ExternalUserService {
  async resolveOrCreate(project, externalUserId, metadata = {}) {
    if (!project) {
      throw new Error('resolveOrCreate: a project (Domain) is required');
    }
    if (!externalUserId) {
      throw new Error('resolveOrCreate: a non-empty externalUserId is required');
    }

    return await externalUserRepository.resolveOrCreate(project, externalUserId, metadata);
  }

  async findByProjectAndExternalUserId(project, externalUserId) {
    return await externalUserRepository.findByProjectAndExternalUserId(project, externalUserId);
  }
}

export default new ExternalUserService();
