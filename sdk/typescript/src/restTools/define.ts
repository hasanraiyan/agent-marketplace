import type { z } from 'zod';
import type {
  CreateRestToolInput,
  RestToolMethod,
  RestToolParamDescriptor,
  RestToolParamRow,
  RestToolResponseMapping,
} from '../types/restTool.js';

/**
 * Reserved token resolved server-side from the calling end-user's session —
 * never agent-fillable, never overridable. Mirrors
 * `RESERVED_TEMPLATE_TOKENS` in `agent-backend`'s `templateEngine.js`.
 */
export const EXTERNAL_USER_ID_TOKEN = '{{externalUserId}}';

/**
 * Typed helpers passed to the `url`/`queryParams`/`headers`/`body` callback
 * form of {@link defineRestTool}, so a tool definition never needs to
 * hand-type a `{{token}}` string (and risk a typo that silently produces a
 * broken template instead of a build-time error).
 */
export interface RestToolTemplateHelpers<TArgs extends Record<string, unknown>> {
  /**
   * References one of `args`' own fields — type-checked against its keys,
   * expands to `{{name}}`. Throws immediately if `name` wasn't declared in
   * `args`, instead of silently emitting a token nothing will ever resolve.
   */
  arg(name: keyof TArgs & string): string;
  /** The reserved `{{externalUserId}}` token — see {@link EXTERNAL_USER_ID_TOKEN}. */
  readonly externalUserId: string;
}

type TemplateString<TArgs extends Record<string, unknown>> =
  | string
  | ((t: RestToolTemplateHelpers<TArgs>) => string);
type TemplateObject<TArgs extends Record<string, unknown>> =
  | Record<string, unknown>
  | ((t: RestToolTemplateHelpers<TArgs>) => Record<string, unknown>);

export interface DefineRestToolOptions<TArgs extends z.ZodRawShape = Record<string, never>> {
  name: string;
  description?: string;
  method: RestToolMethod;
  /**
   * Declares the agent-fillable arguments this tool accepts. Optional — a
   * tool with no dynamic parts (or one already fully described via
   * `paramDescriptors` on `queryParams`/`headers` directly) can omit it.
   * Field types are derived best-effort from the zod schema
   * (string/number/boolean); `.describe()` becomes the arg's description
   * shown to the agent; `.optional()` fields are not required.
   */
  args?: z.ZodObject<TArgs>;
  /** May be a literal `"{{token}}"` string, or a callback using the typed helpers. */
  url: TemplateString<z.infer<z.ZodObject<TArgs>>>;
  queryParams?: Record<string, TemplateString<z.infer<z.ZodObject<TArgs>>>>;
  headers?: Record<string, TemplateString<z.infer<z.ZodObject<TArgs>>>>;
  /** A plain object (JSON-stringified as-is) or a callback building one from the typed helpers. Setting this implies `bodyMode: 'json'`. */
  body?: TemplateObject<z.infer<z.ZodObject<TArgs>>>;
  /**
   * `{ type: 'none' }` (default) or `{ type: 'bearerSecret' }` — sends
   * `Authorization: Bearer <value>` on every call to this tool's `url`.
   * `secretRef` is **optional**: omit it and Persona uses the secret already
   * configured on the REST Tool Source itself (the one picked once when the
   * source was registered in the dashboard) — you never need to know or
   * reference a Secret id in code at all for the common case of "this whole
   * source's tools share one key". Pass an explicit `secretRef` (a Persona
   * `ProjectSecret` id) only when one specific tool needs a *different*
   * secret from the rest of the source.
   */
  auth?: { type: 'none' } | { type: 'bearerSecret'; secretRef?: string };
  /**
   * Reshapes the raw JSON response before the agent sees it, e.g.
   * `{ name: '@data.user.name' }`. Omit to pass the raw response through
   * unmapped.
   */
  responseMappings?: Record<string, string>;
  /** @default true */
  isEnabled?: boolean;
}

function isZodOptional(field: unknown): boolean {
  const candidate = field as { isOptional?: () => boolean } | undefined;
  return typeof candidate?.isOptional === 'function' ? candidate.isOptional() : false;
}

function zodTypeName(field: unknown): 'string' | 'number' | 'boolean' {
  // Best-effort duck-typing across zod v3 (`_def.typeName`) and v4
  // (`_zod.def.type`) internals — a schema this doesn't recognize (a
  // wrapped/refined/union type, say) falls back to 'string', the same
  // default `templateEngine.js`'s `zodTypeFor` uses server-side.
  let cur: any = field;
  for (let i = 0; i < 5 && cur; i++) {
    const typeName = cur?._def?.typeName ?? cur?._zod?.def?.type;
    if (typeName === 'ZodNumber' || typeName === 'number') return 'number';
    if (typeName === 'ZodBoolean' || typeName === 'boolean') return 'boolean';
    if (typeName === 'ZodString' || typeName === 'string') return 'string';
    cur = cur?._def?.innerType ?? cur?._zod?.def?.innerType;
  }
  return 'string';
}

function buildParamDescriptors(args: z.ZodObject<any> | undefined): RestToolParamDescriptor[] {
  if (!args) return [];
  const shape: Record<string, unknown> = (args as any).shape ?? {};
  if (Object.prototype.hasOwnProperty.call(shape, 'externalUserId')) {
    throw new Error(
      'defineRestTool: "externalUserId" is a reserved template token and cannot be declared in `args` — reference it via `t.externalUserId` instead.'
    );
  }
  return Object.entries(shape).map(([name, field]) => ({
    name,
    in: 'body',
    type: zodTypeName(field),
    description: (field as { description?: string })?.description ?? '',
    required: !isZodOptional(field),
  }));
}

function makeHelpers<TArgs extends Record<string, unknown>>(
  argNames: string[]
): RestToolTemplateHelpers<TArgs> {
  return {
    arg(name) {
      if (!argNames.includes(name)) {
        throw new Error(
          `defineRestTool: unknown arg "${String(name)}" — declared args are: ${argNames.join(', ') || '(none)'}`
        );
      }
      return `{{${String(name)}}}`;
    },
    get externalUserId() {
      return EXTERNAL_USER_ID_TOKEN;
    },
  };
}

function resolveTemplateString(value: TemplateString<any>, t: RestToolTemplateHelpers<any>): string {
  return typeof value === 'function' ? value(t) : value;
}

function toParamRows(
  entries: Record<string, TemplateString<any>> | undefined,
  t: RestToolTemplateHelpers<any>
): RestToolParamRow[] {
  if (!entries) return [];
  return Object.entries(entries).map(([key, value]) => ({
    key,
    valueTemplate: resolveTemplateString(value, t),
    required: true,
  }));
}

function toResponseMappings(
  mappings: Record<string, string> | undefined
): RestToolResponseMapping[] {
  if (!mappings) return [];
  return Object.entries(mappings).map(([field, path]) => ({ field, path }));
}

/**
 * Builds one {@link CreateRestToolInput}-shaped tool definition for a
 * REST Tool Source's hosted manifest (see `@personaai/runtime`'s
 * `restToolsManifest` option), deriving `paramDescriptors` from a zod
 * schema instead of hand-writing descriptor objects, and offering typed
 * `{{token}}` helpers so the raw template syntax never needs to be typed
 * out by hand. `zod` is an optional peer dependency of `@personaai/sdk` —
 * only needed if you use this helper (or the plain-object form of
 * `args`/omit `args` entirely).
 *
 * @example
 * ```ts
 * import { defineRestTool } from '@personaai/sdk/rest-tools';
 * import { z } from 'zod';
 *
 * const getProfile = defineRestTool({
 *   name: 'Get learner profile',
 *   method: 'GET',
 *   args: z.object({ userId: z.string().describe('Coursify user id') }),
 *   url: (t) => `https://api.coursify.dev/users/${t.arg('userId')}`,
 *   headers: { 'X-Persona-User': (t) => t.externalUserId },
 *   // No `secretRef` needed — reuses whatever secret is configured on the
 *   // REST Tool Source itself.
 *   auth: { type: 'bearerSecret' },
 *   responseMappings: { name: '@data.name', email: '@data.email' },
 * });
 * ```
 */
export function defineRestTool<TArgs extends z.ZodRawShape = Record<string, never>>(
  opts: DefineRestToolOptions<TArgs>
): CreateRestToolInput {
  const paramDescriptors = buildParamDescriptors(opts.args as z.ZodObject<any> | undefined);
  const t = makeHelpers(paramDescriptors.map((d) => d.name));

  const body = opts.body
    ? typeof opts.body === 'function'
      ? opts.body(t)
      : opts.body
    : undefined;

  return {
    name: opts.name,
    description: opts.description,
    method: opts.method,
    url: resolveTemplateString(opts.url, t),
    queryParams: toParamRows(opts.queryParams, t),
    headers: toParamRows(opts.headers, t),
    bodyMode: body !== undefined ? 'json' : 'none',
    bodyTemplate: body !== undefined ? JSON.stringify(body) : undefined,
    paramDescriptors,
    authType: opts.auth?.type ?? 'none',
    secretRef: opts.auth?.type === 'bearerSecret' ? opts.auth.secretRef : undefined,
    responseMappings: toResponseMappings(opts.responseMappings),
    isEnabled: opts.isEnabled ?? true,
  };
}
