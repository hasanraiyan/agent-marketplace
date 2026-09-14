// Shared parsing/normalization helpers for hooks that consume the AG-UI
// event stream and thread-history payload — used by both useChat and
// useArchitectChat, since both talk to structurally identical backend
// runtimes (agui.service.js's runAgentAsAguiEvents drives both).

import type {
  PersonaInterrupt,
  PersonaPresentedFile,
  PersonaSubagentActivityEntry,
  PersonaWorkspaceFile,
} from "../types.js";

// A failed tool call's TOOL_CALL_RESULT content is a JSON envelope
// (`{status:'error',message}`, see aguiTranslator.js's buildToolErrorContent)
// rather than a separate boolean field on the event itself.
export function isErrorToolContent(content: string): boolean {
  if (typeof content !== "string" || !content.trim().startsWith("{"))
    return false;
  try {
    return JSON.parse(content)?.status === "error";
  } catch {
    return false;
  }
}

// Persisted subagent trace item shape (agent-backend's foldSubagentEvent/
// subagentTrace.js) — already folded/paired server-side for compact storage,
// DIFFERENT from the raw per-event `PersonaSubagentActivityEntry` shape the
// live SSE stream sends (kind: 'text'|'tool_start'|'tool_result'). Reloading
// a thread previously never read `data.subagentTraces` at all — a completed
// subagent's activity (its own text/tool timeline) was silently dropped on
// reload even though the backend already persists and returns it, keyed by
// the owning `task` tool call's toolCallId (see agui.controller.js's
// `subagentTraces[callId]`, matching `PersonaToolCall.toolCallId` exactly).
export type PersistedSubagentTraceItem =
  | { type: "text"; text: string }
  | {
      type: "tool";
      name: string;
      argsText: string;
      resultText: string;
      status: "running" | "completed";
    };

// Re-expands the folded/paired persisted shape back into the raw kind-based
// entries `PersonaSubagentActivityEntry` (and everything downstream that
// consumes it — buildSubagentTimeline, the live-preview row, the activity
// dialog) already knows how to render, so no sdk/ui changes are needed.
export function persistedTraceToActivityEntries(
  items: PersistedSubagentTraceItem[],
): PersonaSubagentActivityEntry[] {
  const entries: PersonaSubagentActivityEntry[] = [];
  for (const item of items) {
    if (item.type === "text") {
      if (item.text) entries.push({ kind: "text", delta: item.text });
    } else {
      entries.push({
        kind: "tool_start",
        toolName: item.name,
        args: item.argsText,
      });
      if (item.status === "completed") {
        entries.push({
          kind: "tool_result",
          toolName: item.name,
          result: item.resultText,
        });
      }
    }
  }
  return entries;
}

// present_file's result is `{status:'success', filePath, title, description}`
// (see present.tool.js) — a signal to highlight that path in the workspace
// files panel, not something meant to render as a generic tool-result blob.
export function parsePresentedFile(content: string): PersonaPresentedFile | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.status !== "success" || typeof parsed.filePath !== "string")
      return null;
    return {
      path: parsed.filePath,
      title: typeof parsed.title === "string" ? parsed.title : parsed.filePath,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return null;
  }
}

// buildFilesTodosSnapshot (aguiTranslator.js) emits snake_case
// created_at/modified_at on the wire — both from the live STATE_SNAPSHOT
// event and from a reloaded thread's persisted state (checkpoint.service.js
// runs the same function). Normalize to the SDK's usual camelCase shape.
export function normalizeWorkspaceFiles(
  raw: Record<
    string,
    {
      content: string;
      size: number;
      created_at: string | null;
      modified_at: string | null;
    }
  >,
): Record<string, PersonaWorkspaceFile> {
  const normalized: Record<string, PersonaWorkspaceFile> = {};
  for (const [path, file] of Object.entries(raw || {})) {
    normalized[path] = {
      content: file.content,
      size: file.size,
      createdAt: file.created_at,
      modifiedAt: file.modified_at,
    };
  }
  return normalized;
}

// checkpointService.getMessages() wraps a paused thread's interrupt as
// `{ kind, value }` (see checkpoint.service.js) — the same envelope shape
// the live hitl_request/clarification_request CUSTOM events carry, just
// nested one level deeper. Flatten both into the same PersonaInterrupt shape.
export function normalizePendingInterrupt(pending: unknown): PersonaInterrupt | null {
  if (!pending || typeof pending !== "object") return null;
  const p = pending as { kind?: string; value?: Record<string, unknown> };
  if (p.kind === "hitl") {
    return {
      kind: "hitl",
      actionRequests: (p.value?.actionRequests ?? []) as Extract<
        PersonaInterrupt,
        { kind: "hitl" }
      >["actionRequests"],
      reviewConfigs: (p.value?.reviewConfigs ?? []) as unknown[],
    };
  }
  if (p.kind === "clarification") {
    return {
      kind: "clarification",
      questions: (p.value?.questions ?? []) as Extract<
        PersonaInterrupt,
        { kind: "clarification" }
      >["questions"],
    };
  }
  return null;
}
