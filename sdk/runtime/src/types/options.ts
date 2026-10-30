import type { RuntimeRequest } from './request.js';
import type { RuntimeResponse } from './response.js';
import type { RuntimeHooks } from './hooks.js';
import type { CreateRestToolInput, Logger, LogLevel } from '@personaai/sdk';
import type { RcpTool } from 'rcp-sdk';

/**
 * One REST tool definition served by the manifest route — identical to
 * `CreateRestToolInput` from `@personaai/sdk@^0.7.0` (also `defineRestTool`'s
 * return type from `@personaai/sdk/rest-tools`), aliased under this name for
 * clarity at the call site (`createRuntime({ restToolsManifest: { tools } })`).
 */
export type RestToolManifestEntry = CreateRestToolInput;

/**
 * The single point of contact between the host's auth world and the
 * runtime's world. Receives the inbound request (with `userId: null`) and
 * returns the resolved external user id, or `null`/a thrown error if the
 * request isn't authenticated — either way the runtime responds 401.
 * Persona never authenticates users; this function is entirely the host's.
 */
export type ResolveUser = (request: RuntimeRequest) => string | null | Promise<string | null>;

/**
 * Every one of these is `false` unless explicitly enabled — always-off by
 * default so upgrading this package never silently exposes new surface to
 * whoever `resolveUser` accepts. Most are Project-level configuration (LLM
 * provider credentials, skill/knowledge-base/vector-store management,
 * security audit logs, an agent-building co-pilot) rather than things an end
 * user does in a chat session — most hosts should manage them via
 * `@personaai/sdk` directly from their own admin surface and never turn
 * these on. `messages` is a per-request action rather than configuration,
 * but it's off for the same reason: a send reaches whatever recipient the
 * caller names. Turn one on only if you specifically want it reachable
 * through whatever `resolveUser` gates (which may not be "any logged-in end
 * user" — that's your call).
 */
export interface RuntimeCapabilities {
  /** Full Agent CRUD (create/get/update/delete/bulk-delete) beyond the always-on read-only `GET /agents` list. @default false */
  agentsWrite?: boolean;
  /** Full MCP server CRUD + testConnection/readResource/callTool, beyond the always-on `/mcps/:id/oauth/*` routes. @default false */
  mcps?: boolean;
  /** LLM provider configuration — **holds API keys**. @default false */
  providers?: boolean;
  /** Skill authoring. @default false */
  skills?: boolean;
  /** Knowledge base CRUD, document upload/search. @default false */
  knowledge?: boolean;
  /** Vector store CRUD and file read/write. @default false */
  stores?: boolean;
  /** RCP (REST Connector Protocol) source CRUD + Test Connection. @default false */
  rcpSources?: boolean;
  /** Security/compliance audit log read access. @default false */
  auditLogs?: boolean;
  /** The Architect co-pilot — builds/edits Agents on the caller's behalf via tool calls. @default false */
  architect?: boolean;
  /** Full Workflow CRUD, draft authoring, versions, and Mermaid export beyond the always-on execution routes. @default false */
  workflowsWrite?: boolean;
  /**
   * Outbound SMS/WhatsApp (`POST /messages`, `POST /messages/agent`). Off by
   * default because `to` is any E.164 number and every send spends this
   * Project's Twilio balance — unlike `chat`/`voice` these routes aren't
   * end-user-scoped. @default false
   */
  messages?: boolean;
}

/**
 * Serves a list of code-defined REST tools (built with `defineRestTool`
 * from `@personaai/sdk/rest-tools`) as a JSON manifest at
 * `GET {mountPath}/rest-tools/manifest` — register that URL in the Persona
 * dashboard as a REST Tool Source and it discovers/calls these tools live,
 * the same way it discovers an MCP server's tools. This is host-side
 * static data the runtime *serves*, not a Persona-proxy capability — it
 * never calls `PersonaClient` and works even with no `resolveUser`
 * traffic at all.
 */
export interface RestToolsManifestOptions {
  /** REST tool definitions to serve — build each with `defineRestTool` from `@personaai/sdk/rest-tools`, or pass a plain object of the same shape. */
  tools: RestToolManifestEntry[];
  /**
   * Required `Authorization: Bearer <token>` value the manifest route
   * checks incoming requests against — must match the API Key configured
   * on the Persona-side REST Tool Source. Omitting this leaves the route
   * open (no auth) — only acceptable for local/dev testing.
   */
  authToken?: string;
}

/**
 * Serves a list of code-defined RCP (REST Connector Protocol, npm `rcp-sdk`)
 * tools as a conformant `{ rcpVersion, auth, tools }` manifest at
 * `GET {mountPath}/rcp/manifest` — register that URL as an RCP source and
 * any RCP client (Persona included) discovers/calls these tools live.
 * Independent of {@link RestToolsManifestOptions} — unrelated protocols,
 * both servable from the same runtime instance if you want both.
 */
export interface RcpManifestOptions {
  /** RCP tool definitions to serve — build each with `defineTool` from `rcp-sdk/server`. */
  tools: RcpTool[];
  /**
   * Required `Authorization: Bearer <token>` value the manifest route
   * checks incoming requests against. Omitting this leaves the route open
   * (`auth: { type: 'none' }` in the served manifest) — only acceptable
   * for local/dev testing.
   */
  authToken?: string;
}

/**
 * A Twilio webhook request that reached this runtime, after its signature
 * was verified. `from` is the end user's number (WhatsApp numbers keep the
 * `whatsapp:` prefix), `body` is the message text on the message channel.
 */
export interface TwilioChannelRequest {
  channel: 'voice' | 'whatsapp' | 'sms';
  from: string;
  to: string;
  /** Present on the voice channel. */
  callSid?: string;
  /** Present on the message channel. */
  messageSid?: string;
  /** Present on the message channel — the inbound text. */
  body?: string;
  /** WhatsApp profile name, when Twilio supplies one. */
  profileName?: string;
}

/**
 * Return value of {@link TwilioChannelOptions.resolveUser}: the developer's
 * own user id (which becomes the Persona external user id), optionally with
 * a per-request Agent override. `null` means "not one of my users" — the
 * runtime then rejects the call / sends no reply.
 */
export interface TwilioChannelUser {
  externalUserId: string;
  agentId?: string;
  /** Continue an existing thread instead of the per-user default. */
  threadId?: string;
}

export type ResolveTwilioChannelUser = (
  request: TwilioChannelRequest
) => TwilioChannelUser | string | null | Promise<TwilioChannelUser | string | null>;

/**
 * Bring-your-own-Twilio-number webhooks, served by this runtime:
 * `POST /channels/twilio/voice` and `POST /channels/twilio/message`.
 *
 * Both routes verify Twilio's `X-Twilio-Signature` with YOUR auth token,
 * resolve the sender to one of your users, and proxy to Persona. Voice
 * returns TwiML that points Twilio's media stream straight at Persona (your
 * server never relays audio); messaging returns the Agent's reply as TwiML,
 * so no message is sent from Persona's own account.
 */
export interface TwilioChannelOptions {
  /** Your Twilio Auth Token — used only to verify inbound webhook signatures. */
  authToken: string;
  /**
   * The exact public origin Twilio calls, e.g. `https://app.example.com`.
   * Twilio signs the full URL, so a proxy/rewrite that changes it breaks
   * verification — set this when the request's own host headers aren't the
   * public URL. Omit to derive it from `x-forwarded-proto` / `host`.
   */
  publicUrl?: string;
  /** Maps a Twilio sender to one of your users. Return `null` to ignore the message/call. */
  resolveUser: ResolveTwilioChannelUser;
  /** Default Agent for both channels. `resolveUser` may override it per request. */
  agentId?: string;
  /** Spoken instead of the Agent's voice when the session cannot start. */
  voiceFallback?: string;
  /** Texted instead of the Agent's reply when the turn fails. `''` disables it. */
  messageFallback?: string;
}

export interface ChannelsOptions {
  /** Enables the two Twilio channel routes. Unset by default. */
  twilio?: TwilioChannelOptions;
}

export interface CreateRuntimeOptions {
  /** Base URL of the Persona Developer Platform API, e.g. "https://api.persona.hasanraiyan.me". */
  baseUrl: string;
  /** Project credential, shaped "<keyId>.<secret>" — never expose this to a browser. */
  credential: string;
  resolveUser: ResolveUser;
  hooks?: RuntimeHooks;
  /** Prefix to strip from `request.path` before routing, e.g. '/api/persona'. @default '' (no stripping) */
  mountPath?: string;
  /**
   * 'development' includes error detail (message/stack/upstream response)
   * in error responses; 'production' hides it behind a generic message.
   * @default 'production', unless `process.env.NODE_ENV === 'development'`.
   */
  mode?: 'development' | 'production';
  /** Override fetch (proxying, tracing, or test injection). Forwarded to every per-request PersonaClient. */
  fetch?: typeof fetch;
  /**
   * How often to send an SSE comment-line heartbeat (`: heartbeat\n\n`)
   * during a gap in the `/chat` stream — e.g. a long-running tool call with
   * no token output — so intermediary proxies/load balancers with an idle
   * timeout don't kill the connection. Comment lines are invisible to any
   * `data:`-only SSE parser (including `@personaai/sdk`'s own), so this
   * never changes the AG-UI event sequence a consumer sees.
   * @default 15000
   */
  heartbeatIntervalMs?: number;
  /**
   * How long a finished `/chat` run stays resumable via `GET /chat/:runId/resume`
   * before an internal eviction sweep removes it.
   * @default 300000 (5 minutes)
   */
  runGraceMs?: number;
  /**
   * Safety valve on the in-memory resumable-run registry — once over this
   * many tracked runs, the oldest-finished ones are evicted first (still
   * in-flight runs are never evicted by this cap).
   * @default 1000
   */
  maxTrackedRuns?: number;
  /** Opt-in switches for Project-level admin surface. See {@link RuntimeCapabilities} — everything defaults to off. */
  capabilities?: RuntimeCapabilities;
  /** Serves a code-defined REST tool list for a Persona REST Tool Source to discover. See {@link RestToolsManifestOptions}. Unset by default — the route only exists when this is provided. */
  restToolsManifest?: RestToolsManifestOptions;
  /** Serves a conformant RCP manifest for any RCP client to discover. See {@link RcpManifestOptions}. Unset by default — the route only exists when this is provided. */
  rcpManifest?: RcpManifestOptions;
  /**
   * Bring-your-own-Twilio-number webhook routes (`/channels/twilio/*`). See
   * {@link ChannelsOptions}. Unset by default — the routes only exist when
   * this is provided.
   */
  channels?: ChannelsOptions;
  /** Log level for the runtime — off by default. Overrides the global level set via `setLogLevel()` from `@personaai/sdk`. */
  logLevel?: LogLevel;
  /** Custom logger instance — when provided, `logLevel` is ignored. */
  logger?: Logger;
}

export interface Runtime {
  handle(request: RuntimeRequest): Promise<RuntimeResponse>;
  /**
   * Stops the background eviction timer used for resumable-run bookkeeping.
   * The timer is `unref`'d and won't itself keep a Node process alive, so
   * calling this is optional — but do call it if you `createRuntime()`
   * repeatedly in a long-lived process (e.g. per-test-suite setup) to avoid
   * accumulating timers.
   */
  close(): void;
}
