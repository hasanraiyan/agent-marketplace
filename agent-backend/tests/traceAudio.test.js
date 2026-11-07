import { jest } from '@jest/globals';
import { PassThrough } from 'stream';

const service = {
  list: jest.fn(),
  get: jest.fn(),
  stats: jest.fn(),
  getAudio: jest.fn(),
  openAudioStream: jest.fn(),
};
jest.unstable_mockModule('../src/modules/traces/trace.service.js', () => ({ default: service }));

const mod = await import('../src/modules/traces/trace.controller.js');
const controller = mod.default;
const { parseRange } = mod;

function mockRes() {
  const res = new PassThrough();
  res.headers = {};
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.body = () => res.read();
  return res;
}

const req = (extra = {}) => ({
  projectAdminContext: { domain: 'proj1' },
  query: {},
  params: { traceId: 't1' },
  headers: {},
  ...extra,
});

describe('parseRange', () => {
  test.each([
    [undefined, 100, null],
    ['bytes=0-', 100, { start: 0, end: 99 }],
    ['bytes=10-19', 100, { start: 10, end: 19 }],
    ['bytes=90-500', 100, { start: 90, end: 99 }],
    ['bytes=-10', 100, { start: 90, end: 99 }],
    ['bytes=100-', 100, 'invalid'],
    ['bytes=20-10', 100, 'invalid'],
    ['bytes=-0', 100, 'invalid'],
    ['bytes=0-1,5-6', 100, null],
  ])('%s of %d → %j', (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});

describe('TraceController.audio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.getAudio.mockResolvedValue({ key: 't1.wav', size: 100, mimeType: 'audio/wav' });
    service.openAudioStream.mockImplementation(() => {
      const s = new PassThrough();
      process.nextTick(() => s.end(Buffer.from('RIFF')));
      return s;
    });
  });

  test('streams the whole file with Accept-Ranges', async () => {
    const res = mockRes();
    await controller.audio(req(), res, jest.fn());
    expect(service.getAudio).toHaveBeenCalledWith('proj1', 't1');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/wav');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe('100');
    expect(service.openAudioStream).toHaveBeenCalledWith('t1.wav', undefined);
  });

  test('answers a Range request with 206 and Content-Range', async () => {
    const res = mockRes();
    await controller.audio(req({ headers: { range: 'bytes=10-19' } }), res, jest.fn());
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 10-19/100');
    expect(res.headers['content-length']).toBe('10');
    expect(service.openAudioStream).toHaveBeenCalledWith('t1.wav', { start: 10, end: 19 });
  });

  test('416 for an unsatisfiable range', async () => {
    const res = mockRes();
    res.end = jest.fn();
    await controller.audio(req({ headers: { range: 'bytes=500-' } }), res, jest.fn());
    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe('bytes */100');
    expect(service.openAudioStream).not.toHaveBeenCalled();
  });

  test('forwards service errors (404 / 409) to next()', async () => {
    const err = Object.assign(new Error('not ready'), { statusCode: 409 });
    service.getAudio.mockRejectedValue(err);
    const next = jest.fn();
    await controller.audio(req(), mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('list() passes the channel filter', async () => {
    service.list.mockResolvedValue({ items: [], total: 0 });
    await controller.list(req({ query: { channel: 'voice' } }), { json: jest.fn() }, jest.fn());
    expect(service.list).toHaveBeenCalledWith(
      'proj1',
      expect.objectContaining({ channel: 'voice' }),
      expect.any(Object)
    );
  });
});
