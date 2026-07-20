import healthRepo from '../src/modules/health/health.repository.js';

describe('healthRepository', () => {
  test('fetchServerStatus returns uptime number', () => {
    const status = healthRepo.fetchServerStatus();
    expect(status).toHaveProperty('uptime');
    expect(typeof status.uptime).toBe('number');
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});
