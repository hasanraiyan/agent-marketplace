import { jest } from '@jest/globals';

const mockFetchServerStatus = jest.fn().mockReturnValue({ uptime: 123.456 });

jest.unstable_mockModule('../src/repositories/healthRepository.js', () => ({
  default: { fetchServerStatus: mockFetchServerStatus },
}));

describe('Health Service', () => {
  let healthService;

  beforeAll(async () => {
    const mod = await import('../src/services/healthService.js');
    healthService = mod.default;
  });

  beforeEach(() => {
    mockFetchServerStatus.mockClear();
  });

  test('should return status ok', () => {
    const result = healthService.getHealth();
    expect(result.status).toBe('ok');
  });

  test('should return a valid ISO timestamp', () => {
    const result = healthService.getHealth();
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  test('should return uptime from repository', () => {
    const result = healthService.getHealth();
    expect(mockFetchServerStatus).toHaveBeenCalled();
    expect(result.uptime).toBe(123.456);
  });

  test('should call fetchServerStatus on each invocation', () => {
    healthService.getHealth();
    healthService.getHealth();
    expect(mockFetchServerStatus).toHaveBeenCalledTimes(2);
  });

  test('should return object with exactly 3 properties', () => {
    const result = healthService.getHealth();
    expect(Object.keys(result)).toEqual(['status', 'timestamp', 'uptime']);
  });
});
