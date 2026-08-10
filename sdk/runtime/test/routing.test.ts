import { describe, expect, it } from 'vitest';
import { matchRoute, stripMountPath, type Route } from '../src/routing.js';

const noop = async () => ({ kind: 'buffered' as const, status: 200, headers: {}, body: '' });

const routes: Route[] = [
  { method: 'GET', pattern: ['health'], handler: noop, requiresAuth: false },
  { method: 'GET', pattern: ['threads'], handler: noop },
  { method: 'POST', pattern: ['threads'], handler: noop },
  { method: 'GET', pattern: ['threads', ':id'], handler: noop },
  { method: 'DELETE', pattern: ['threads', ':id'], handler: noop },
];

describe('matchRoute', () => {
  it('matches a literal route', () => {
    const result = matchRoute(routes, 'GET', '/health');
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.route.pattern).toEqual(['health']);
  });

  it('extracts :id params', () => {
    const result = matchRoute(routes, 'GET', '/threads/abc123');
    expect(result).toEqual({
      kind: 'matched',
      route: routes[3],
      params: { id: 'abc123' },
    });
  });

  it('returns not-found for an unknown path', () => {
    expect(matchRoute(routes, 'GET', '/nope')).toEqual({ kind: 'not-found' });
  });

  it('returns method-not-allowed with the correct Allow list for a known path, wrong method', () => {
    const result = matchRoute(routes, 'PATCH', '/threads');
    expect(result).toEqual({ kind: 'method-not-allowed', allowed: ['GET', 'POST'] });
  });

  it('decodes URI-encoded :id segments', () => {
    const result = matchRoute(routes, 'GET', '/threads/a%20b');
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.params.id).toBe('a b');
  });
});

describe('stripMountPath', () => {
  it('strips a configured mount path', () => {
    expect(stripMountPath('/api/persona/health', '/api/persona')).toBe('/health');
  });

  it('is tolerant of an adapter that already stripped the prefix', () => {
    expect(stripMountPath('/health', '/api/persona')).toBe('/health');
  });

  it('is a no-op when no mountPath is configured', () => {
    expect(stripMountPath('/api/persona/health', undefined)).toBe('/api/persona/health');
  });

  it('handles the mount path with no trailing segment', () => {
    expect(stripMountPath('/api/persona', '/api/persona')).toBe('/');
  });
});
