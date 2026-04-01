import request from 'supertest';
import app from '../src/index.js';

describe('GET /health (integration)', () => {
  test('responds with health status and uptime', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('uptime');
    expect(typeof res.body.data.uptime).toBe('number');
  });
});
