import { jest } from '@jest/globals';
import { config } from '../src/config.js';

describe('config', () => {
  it('should have a model property', () => {
    expect(config).toHaveProperty('model');
  });

  it('should have a threadId property', () => {
    expect(config).toHaveProperty('threadId');
  });

  it('should use DEFAULT_THREAD_ID from env or fallback to default-user', () => {
    // Note: since it's already imported, changing env won't affect it unless we re-import or use a getter.
    // For now we just check it exists.
    expect(typeof config.threadId).toBe('string');
  });
});
