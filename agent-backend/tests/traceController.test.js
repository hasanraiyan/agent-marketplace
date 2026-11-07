import { jest } from '@jest/globals';

const service = { list: jest.fn(), get: jest.fn(), stats: jest.fn() };
jest.unstable_mockModule('../src/modules/traces/trace.service.js', () => ({ default: service }));

const controller = (await import('../src/modules/traces/trace.controller.js')).default;

function mockRes() {
  return { json: jest.fn() };
}

const req = (extra = {}) => ({
  projectAdminContext: { domain: 'proj1' },
  query: {},
  params: {},
  ...extra,
});

describe('TraceController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('list() returns a pagination envelope and clamps limit', async () => {
    service.list.mockResolvedValue({ items: [{ _id: 't' }], total: 1 });
    const res = mockRes();
    await controller.list(
      req({ query: { page: '1', limit: '500', agentId: 'a1' } }),
      res,
      jest.fn()
    );
    expect(service.list).toHaveBeenCalledWith('proj1', expect.objectContaining({ agentId: 'a1' }), {
      page: 1,
      limit: 100,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { items: [{ _id: 't' }], pagination: { total: 1, page: 1, limit: 100, pages: 1 } },
    });
  });

  test('get() passes the traceId and forwards errors', async () => {
    const err = new Error('nope');
    service.get.mockRejectedValue(err);
    const next = jest.fn();
    await controller.get(req({ params: { traceId: 'x' } }), mockRes(), next);
    expect(service.get).toHaveBeenCalledWith('proj1', 'x');
    expect(next).toHaveBeenCalledWith(err);
  });

  test('stats() passes days and agentId', async () => {
    service.stats.mockResolvedValue({ days: 30 });
    const res = mockRes();
    await controller.stats(req({ query: { days: '30', agentId: 'a1' } }), res, jest.fn());
    expect(service.stats).toHaveBeenCalledWith('proj1', { agentId: 'a1', days: '30' });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { days: 30 } });
  });
});
