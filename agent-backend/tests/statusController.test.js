import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/status/status.service.js', () => ({
  default: { getStatus: jest.fn() },
}));

const statusService = (await import('../src/modules/status/status.service.js')).default;
const statusController = (await import('../src/modules/status/status.controller.js')).default;

describe('statusController (REQ-8)', () => {
  test('responds with the raw status document, unenveloped', () => {
    const data = {
      status: 'operational',
      latencyTargets: { chatTimeToFirstTokenMsP95: 2000 },
      uptimeTargetPct: 99.9,
      incidents: [],
    };
    statusService.getStatus.mockReturnValue(data);

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    statusController.getStatus(req, res, next);

    expect(res.json).toHaveBeenCalledWith(data);
    expect(next).not.toHaveBeenCalled();
  });

  test('error path calls next with the error', () => {
    statusService.getStatus.mockImplementation(() => {
      throw new Error('boom');
    });

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    statusController.getStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });
});
