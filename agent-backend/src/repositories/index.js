import healthRepository from '../modules/health/health.repository.js';
import userRepository from '../modules/users/user.repository.js';
import InMemoryRateLimitStore from './rateLimiter.repository.js';

export { healthRepository, userRepository, InMemoryRateLimitStore };
export default {
  healthRepository,
  userRepository,
  InMemoryRateLimitStore,
};
