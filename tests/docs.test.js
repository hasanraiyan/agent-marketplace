import request from 'supertest';
import app from '../src/index.js';

describe('GET /docs', () => {
  test('serves Swagger UI HTML or redirects to docs root', async () => {
    const res = await request(app).get('/docs');

    // Accept either direct HTML response or a redirect to the docs root
    expect([200, 301, 302]).toContain(res.status);

    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text.toLowerCase()).toMatch(/swagger-ui|swagger ui/);
    } else {
      expect(res.headers.location || '').toMatch(/docs/);
    }
  });
});
