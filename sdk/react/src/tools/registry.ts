import type { ReactNode } from "react";
import type { PersonaToolCall } from "../types.js";
import { parsePartialJson } from "./partialJson.js";

/**
 * Lifecycle of a tool call as seen by the client:
 * - `inProgress` — arguments are still streaming in (`args` is partial).
 * - `executing`  — arguments are complete; the tool is running (or, for a
 *   call loaded from history, never produced a result).
 * - `complete`   — the tool's result has arrived (`result` is set).
 */
export type PersonaToolCallStatus = "inProgress" | "executing" | "complete";

interface PersonaToolRenderBase {
  /** The tool's name, e.g. `search_programs`. */
  name: string;
  toolCallId: string;
  /** True when the tool reported a failure (its result is an error envelope). */
  isError: boolean;
  /** The raw call, for anything not surfaced above. */
  toolCall: PersonaToolCall;
}

/** Props passed to a `useRenderTool` render function — discriminated by `status`. */
export type PersonaToolRenderProps<TArgs = Record<string, unknown>> =
  | (PersonaToolRenderBase & {
      status: "inProgress";
      args: Partial<TArgs>;
      result: undefined;
    })
  | (PersonaToolRenderBase & {
      status: "executing";
      args: TArgs;
      result: undefined;
    })
  | (PersonaToolRenderBase & {
      status: "complete";
      args: TArgs;
      result: string;
    });

export type PersonaToolRenderFn<TArgs = Record<string, unknown>> = (
  props: PersonaToolRenderProps<TArgs>,
) => ReactNode;

/** Wildcard name: renders any tool call that has no renderer of its own. */
export const ANY_TOOL = "*";

/**
 * Derive a tool call's status from the call itself, so it works the same for
 * a live stream and for a thread reloaded from history.
 */
export function getToolCallStatus(
  toolCall: PersonaToolCall,
): PersonaToolCallStatus {
  if (toolCall.result !== undefined) return "complete";
  const args = (toolCall.args ?? "").trim();
  if (!args) return "inProgress";
  try {
    JSON.parse(args);
    return "executing";
  } catch {
    return "inProgress";
  }
}

function toArgsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Build the render props for a tool call (exported for custom renderers/tests). */
export function buildToolRenderProps(
  toolCall: PersonaToolCall,
): PersonaToolRenderProps {
  const status = getToolCallStatus(toolCall);
  const base: PersonaToolRenderBase = {
    name: toolCall.toolName,
    toolCallId: toolCall.toolCallId,
    isError: !!toolCall.isError,
    toolCall,
  };
  const args = toArgsObject(parsePartialJson(toolCall.args));
  if (status === "complete")
    return { ...base, status, args, result: toolCall.result as string };
  return { ...base, status, args, result: undefined };
}

interface RendererEntry {
  id: symbol;
  render: PersonaToolRenderFn;
}

/**
 * Holds the tool renderers registered by `useRenderTool`. One per
 * `PersonaProvider`; a store compatible with `useSyncExternalStore`.
 */
export class PersonaToolRegistry {
  private renderers = new Map<string, RendererEntry>();
  private listeners = new Set<() => void>();
  private version = 0;

  /**
   * Register a renderer for `name` (or `"*"`). The latest registration wins.
   * Returns an unregister function that only removes *this* registration.
   */
  registerRenderer(name: string, render: PersonaToolRenderFn): () => void {
    const entry: RendererEntry = { id: Symbol(name), render };
    this.renderers.set(name, entry);
    this.emit();
    return () => {
      if (this.renderers.get(name)?.id === entry.id) {
        this.renderers.delete(name);
        this.emit();
      }
    };
  }

  /** The renderer for `name`, falling back to the `"*"` wildcard. */
  getRenderer(name: string): PersonaToolRenderFn | undefined {
    return (this.renderers.get(name) ?? this.renderers.get(ANY_TOOL))?.render;
  }

  hasRenderer(name: string): boolean {
    return this.renderers.has(name);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }
}
