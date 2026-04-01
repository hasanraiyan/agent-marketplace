import healthRepo from '../src/repositories/healthRepository.js';

describe('healthRepository', () => {
  test('fetchServerStatus returns uptime number', () => {
    const status = healthRepo.fetchServerStatus();
    expect(status).toHaveProperty('uptime');
    expect(typeof status.uptime).toBe('number');
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});
