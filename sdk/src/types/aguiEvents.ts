/**
 * Typed payloads for this backend's custom AG-UI events — mirrors the Zod
 * schemas served machine-readably at `GET /api/v1/developer/agui/schema`
 * (`agent-backend/src/modules/agui/aguiEventSchemas.js`). Keep these two in
 * sync; the schema endpoint is the source of truth at runtime, this is the
 * compile-time counterpart.
 */

/** The schema document version this SDK release was written against. */
export const AGUI_SCHEMA_VERSION = '1.0.0';

export interface ClarificationQuestion {
  id: string;
  text: string;
  options: string[];
  required: boolean;
  allowCustom: boolean;
}

/** `CUSTOM` event `clarification_request` — pauses the run pending a free-text/multiple-choice answer. */
export interface ClarificationRequestPayload {
  questions: ClarificationQuestion[];
  currentIndex: number;
}

/**
 * `CUSTOM` event `hitl_request` — pauses the run pending approval of one or
 * more pending tool calls (an Agent's `interruptOn` config). `actionRequests`/
 * `reviewConfigs` are opaque langchain `humanInTheLoopMiddleware` structures,
 * passed through as-is by the backend.
 */
export interface HitlRequestPayload {
  actionRequests: unknown[];
  reviewConfigs: unknown[];
}

/**
 * `CUSTOM` event `mcp_app` — an MCP-registered tool call declared an
 * interactive widget via `_meta.ui.resourceUri`.
 */
export interface McpAppPayload {
  toolCallId: string;
  resourceUri: string;
  mcpId: string;
}

/**
 * `CUSTOM` event `subagent_activity` — a nested subagent (deepagents `task`
 * tool) invocation's text/tool activity, discriminated by `kind`.
 */
export type SubagentActivityPayload =
  | { toolCallId: string; kind: 'text'; delta: string }
  | { toolCallId: string; kind: 'tool_start'; toolName: string; args: string }
  | { toolCallId: string; kind: 'tool_result'; toolName: string; result: string };

/** `code` values a `RUN_ERROR` event's `code` field is drawn from. */
export type RunErrorCode =
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_RATE_LIMIT'
  | 'TOOL_TIMEOUT'
  | 'TOOL_ERROR'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'INTERNAL_ERROR';

/**
 * A narrower, app-typed view of the native `@ag-ui/core` `RUN_ERROR` event
 * (already covered by `AguiEvent`'s union — this just gives `code` a literal
 * type instead of `string | undefined`, and documents the extra fields this
 * backend always sends alongside the base protocol's `message`).
 */
export interface PersonaRunErrorEvent {
  type: 'RUN_ERROR';
  code: RunErrorCode;
  message: string;
  retryable: boolean;
  providerName?: string;
}
