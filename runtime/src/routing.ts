import type { RuntimeMethod, RuntimeRequest } from './types/request.js';
import type { RuntimeResponse } from './types/response.js';

export interface RouteContext {
  client: import('@personaai/sdk').PersonaClient;
  hooks: import('./types/hooks.js').RuntimeHooks | undefined;
  mode: 'development' | 'production';
  params: Record<string, string>;
  heartbeatIntervalMs: number;
}

export type RouteHandler = (request: RuntimeRequest, ctx: RouteContext) => Promise<RuntimeResponse>;

export interface Route {
  method: RuntimeMethod;
  /** Segments split on '/': a literal string, or `:name` for a captured param. */
  pattern: string[];
  handler: RouteHandler;
  /** @default true — only `/health` sets this to false. */
  requiresAuth?: boolean;
}

export type MatchResult =
  | { kind: 'matched'; route: Route; params: Record<string, string> }
  | { kind: 'not-found' }
  | { kind: 'method-not-allowed'; allowed: RuntimeMethod[] };

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function matchRoute(routes: Route[], method: RuntimeMethod, path: string): MatchResult {
  const requested = splitPath(path);
  let sawPathMatch = false;
  const allowed = new Set<RuntimeMethod>();

  for (const route of routes) {
    if (route.pattern.length !== requested.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < route.pattern.length; i++) {
      const patternSegment = route.pattern[i]!;
      const requestedSegment = requested[i]!;
      if (patternSegment.startsWith(':')) {
        params[patternSegment.slice(1)] = decodeURIComponent(requestedSegment);
      } else if (patternSegment !== requestedSegment) {
        matched = false;
        break;
      }
    }

    if (!matched) continue;

    sawPathMatch = true;
    allowed.add(route.method);
    if (route.method === method) {
      return { kind: 'matched', route, params };
    }
  }

  if (sawPathMatch) return { kind: 'method-not-allowed', allowed: [...allowed] };
  return { kind: 'not-found' };
}

/** Strips `mountPath` from `path` if present — tolerant of adapters that already stripped it themselves (e.g. a framework's own sub-router). */
export function stripMountPath(path: string, mountPath: string | undefined): string {
  if (!mountPath) return path;
  const normalizedMount = mountPath.endsWith('/') ? mountPath.slice(0, -1) : mountPath;
  if (!normalizedMount) return path;
  if (path === normalizedMount) return '/';
  if (path.startsWith(`${normalizedMount}/`)) return path.slice(normalizedMount.length);
  return path;
}
