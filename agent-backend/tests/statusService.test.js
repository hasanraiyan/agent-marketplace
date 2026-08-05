import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/config/database.js', () => ({
  default: { getConnectionStatus: jest.fn() },
}));

const database = (await import('../src/config/database.js')).default;
const statusService = (await import('../src/modules/status/status.service.js')).default;

describe('statusService (REQ-8)', () => {
  test('reports operational with stated targets when the database is connected', () => {
    database.getConnectionStatus.mockReturnValue(true);

    const result = statusService.getStatus();

    expect(result).toEqual({
      status: 'operational',
      latencyTargets: { chatTimeToFirstTokenMsP95: 2000 },
      uptimeTargetPct: 99.9,
      incidents: [],
    });
  });

  test('reports degraded when the database is disconnected', () => {
    database.getConnectionStatus.mockReturnValue(false);

    const result = statusService.getStatus();

    expect(result.status).toBe('degraded');
  });
});
