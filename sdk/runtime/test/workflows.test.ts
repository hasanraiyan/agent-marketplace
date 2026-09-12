import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('Workflows Routes', () => {
  describe('Always-on: GET /workflows', () => {
    it('forwards query params for list', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ items: [], pagination: {} })
      );
      const runtime = makeRuntime({ fetchMock });

      const response = await runtime.handle({
        method: 'GET',
        path: '/workflows',
        headers: {},
        query: {
          page: '2',
          limit: '10',
          search: 'data',
          scope: 'mine',
          visibility: 'private',
          isEnabled: 'true',
        },
        body: undefined,
        userId: null,
      });

      expect(response.status).toBe(200);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('search=data');
      expect(url).toContain('scope=mine');
      expect(url).toContain('visibility=private');
      expect(url).toContain('isEnabled=true');
    });
  });

  describe('Always-on: POST /workflows/runs/:runId/cancel', () => {
    it('cancels active run', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ success: true, message: 'Run cancelled' })
      );
      const runtime = makeRuntime({ fetchMock });

      const response = await runtime.handle({
        method: 'POST',
        path: '/workflows/runs/run-123/cancel',
        headers: {},
        query: {},
        body: {},
        userId: null,
      });

      expect(response.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/workflows/runs/run-123/cancel');
      expect(init?.method).toBe('POST');
    });
  });

  describe('Gated: capabilities.workflowsWrite', () => {
    it('creates workflow with Idempotency-Key header', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ _id: 'wf_1', name: 'My Flow' }, 201)
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'POST',
        path: '/workflows',
        headers: { 'idempotency-key': 'idem-wf-1' },
        query: {},
        body: { name: 'My Flow', description: 'Flow description' },
        userId: null,
      });

      expect(response.status).toBe(201);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ 'Idempotency-Key': 'idem-wf-1' });
    });

    it('gets workflow details', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ _id: 'wf_1', name: 'My Flow' })
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'GET',
        path: '/workflows/wf_1',
        headers: {},
        query: {},
        body: undefined,
        userId: null,
      });

      expect(response.status).toBe(200);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf_1');
    });

    it('updates workflow meta', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ _id: 'wf_1', name: 'Updated Flow' })
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'PATCH',
        path: '/workflows/wf_1',
        headers: {},
        query: {},
        body: { name: 'Updated Flow' },
        userId: null,
      });

      expect(response.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf_1');
      expect(init?.method).toBe('PATCH');
    });

    it('deletes workflow', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: 204 })
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'DELETE',
        path: '/workflows/wf_1',
        headers: {},
        query: {},
        body: undefined,
        userId: null,
      });

      expect(response.status).toBe(204);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf_1');
      expect(init?.method).toBe('DELETE');
    });

    it('saves draft canvas', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ _id: 'wf_1', draft: { nodes: [], edges: [] } })
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'PUT',
        path: '/workflows/wf_1/draft',
        headers: {},
        query: {},
        body: { nodes: [{ id: 'n1', type: 'trigger', data: { label: 'Start' } }], edges: [] },
        userId: null,
      });

      expect(response.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf_1/draft');
      expect(init?.method).toBe('PUT');
    });

    it('publishes workflow draft', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ version: 1, definition: { nodes: [], edges: [] } }, 201)
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'POST',
        path: '/workflows/wf_1/publish',
        headers: {},
        query: {},
        body: {},
        userId: null,
      });

      expect(response.status).toBe(201);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf_1/publish');
      expect(init?.method).toBe('POST');
    });

    it('lists workflow versions and gets specific version', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ items: [{ version: 1 }], pagination: {} }))
        .mockResolvedValueOnce(jsonResponse({ version: 1, definition: {} }));

      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const listRes = await runtime.handle({
        method: 'GET',
        path: '/workflows/wf_1/versions',
        headers: {},
        query: { page: '1', limit: '10' },
        body: undefined,
        userId: null,
      });
      expect(listRes.status).toBe(200);

      const getRes = await runtime.handle({
        method: 'GET',
        path: '/workflows/wf_1/versions/1',
        headers: {},
        query: {},
        body: undefined,
        userId: null,
      });
      expect(getRes.status).toBe(200);
    });

    it('gets workflow mermaid diagram', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        jsonResponse({ mermaid: 'graph TD;\nA-->B;' })
      );
      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const response = await runtime.handle({
        method: 'GET',
        path: '/workflows/wf_1/mermaid',
        headers: {},
        query: {},
        body: undefined,
        userId: null,
      });

      expect(response.status).toBe(200);
      if (response.kind === 'buffered') {
        const parsed = JSON.parse(response.body);
        expect(parsed.mermaid).toBe('graph TD;\nA-->B;');
      }
    });

    it('lists runs and gets specific run', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ items: [{ _id: 'run-1' }], pagination: {} }))
        .mockResolvedValueOnce(jsonResponse({ _id: 'run-1', status: 'completed' }));

      const runtime = makeRuntime({
        fetchMock,
        capabilities: { workflowsWrite: true },
      });

      const listRes = await runtime.handle({
        method: 'GET',
        path: '/workflows/wf_1/runs',
        headers: {},
        query: { status: 'completed', isDryRun: 'false' },
        body: undefined,
        userId: null,
      });
      expect(listRes.status).toBe(200);

      const getRes = await runtime.handle({
        method: 'GET',
        path: '/workflows/runs/run-1',
        headers: {},
        query: {},
        body: undefined,
        userId: null,
      });
      expect(getRes.status).toBe(200);
    });
  });
});
