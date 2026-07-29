/**
 * Developer Platform — ExternalUser module (AD-02).
 *
 * Not yet mounted anywhere: no controller, no routes exist, and nothing
 * in src/index.js or the Developer auth middleware imports this barrel
 * yet. See the master implementation blueprint §11, §34 Phase 5.
 */
export { default as ExternalUser } from './externalUser.model.js';
export { default as externalUserRepository } from './externalUser.repository.js';
export { default as externalUserService } from './externalUser.service.js';
