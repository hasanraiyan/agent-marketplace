import type { PersonaToolCall } from "@personaai/react";

/**
 * `PersonaToolCall` has no explicit status field (it mirrors the wire
 * protocol: `result` only exists once the call finishes) — this is the one
 * small derivation the visual components need, used everywhere a tool card
 * would otherwise have read a `status` field directly.
 */
export function toolCallStatus(tc: PersonaToolCall): "running" | "done" | "error" {
  if (tc.isError) return "error";
  return tc.result !== undefined ? "done" : "running";
}
