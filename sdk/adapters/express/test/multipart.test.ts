import { describe, expect, it } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { toExpressRouter } from '../src/index.js';
import { createTestApp, makeFakeRuntime, okJson } from './helpers.js';

describe('multipart file upload handling', () => {
  it('parses a single `file` part natively and coexists with express.json()', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/files')
      .field('agentId', 'ag-1')
      .attach('file', Buffer.from('hello world'), 'note.txt')
      .expect(200);

    const uploaded = runtime.requests[0]?.file;
    expect(uploaded?.filename).toBe('note.txt');
    expect(Buffer.from(uploaded!.content).toString()).toBe('hello world');
    expect(runtime.requests[0]?.body).toEqual({ agentId: 'ag-1' });
  });

  it('collects multiple `files` parts for knowledge document upload', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/knowledge/kb1/documents')
      .attach('files', Buffer.from('aaa'), 'a.txt')
      .attach('files', Buffer.from('bbb'), 'b.txt')
      .expect(200);

    const files = runtime.requests[0]?.files;
    expect(files).toHaveLength(2);
    expect(files![0]?.filename).toBe('a.txt');
    expect(files![1]?.filename).toBe('b.txt');
  });

  it('detects multipart case-insensitively but preserves the case-sensitive boundary', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    const boundary = 'AaB03x'; // mixed case on purpose
    const rawBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="note.txt"',
      'Content-Type: text/plain',
      '',
      'hello world',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    await request(app)
      .post('/api/persona/files')
      .set('Content-Type', `Multipart/Form-Data; boundary=${boundary}`)
      .send(rawBody)
      .expect(200);

    const uploaded = runtime.requests[0]?.file;
    expect(uploaded?.filename).toBe('note.txt');
    expect(Buffer.from(uploaded!.content).toString()).toBe('hello world');
  });

  it('keeps a field named __proto__ as a plain field (no prototype pollution)', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/files')
      .field('__proto__', 'polluted')
      .attach('file', Buffer.from('x'), 'x.txt')
      .expect(200);

    const body = runtime.requests[0]?.body as Record<string, unknown> | undefined;
    expect(Object.getPrototypeOf(body)).toBeNull();
    expect(body?.['__proto__']).toBe('polluted');
  });

  it('honors a host-parsed multipart body (multer-shaped req.file) instead of re-reading the stream', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));

    const app = express();
    app.use(express.json());
    app.use('/api/persona', (req: Request, _res: Response, next: NextFunction) => {
      // Simulates what multer does: consumes the raw stream and attaches a
      // parsed file to the request before the adapter runs.
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        (
          req as Request & { file?: { originalname: string; buffer: Buffer; mimetype: string } }
        ).file = {
          originalname: 'sim.txt',
          buffer: Buffer.concat(chunks),
          mimetype: 'text/plain',
        };
        next();
      });
    });
    app.use('/api/persona', toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/files')
      .attach('file', Buffer.from('ignored by adapter'), 'ignored.txt')
      .expect(200);

    expect(runtime.requests[0]?.file?.filename).toBe('sim.txt');
    expect(runtime.requests[0]?.file?.content.length).toBeGreaterThan(0);
  });
});
