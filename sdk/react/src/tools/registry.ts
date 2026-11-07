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
  /**
   * Only for a `useHumanInTheLoop` tool that is waiting on the user
   * (`status: "executing"`): call once with the answer to send to the agent.
   */
  respond?: (value: unknown) => void;
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
 * Tool arguments schema: a JSON Schema object (`type: "object"`), or anything
 * with a `toJSONSchema()` method. For zod, pass `z.toJSONSchema(schema)`.
 */
export type PersonaToolParameters =
  Record<string, unknown> | { toJSONSchema(): Record<string, unknown> };

/** What's sent to the agent for a frontend tool (AG-UI `RunAgentInput.tools`). */
export interface PersonaFrontendToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * - `handler` — `useFrontendTool`: runs code in the browser, returns a result.
 * - `humanInTheLoop` — `useHumanInTheLoop`: waits for the user's `respond()`.
 * - `component` — `useComponent`: renders UI, answers immediately.
 */
export type PersonaFrontendToolKind =
  "handler" | "humanInTheLoop" | "component";

export interface PersonaFrontendToolContext {
  /** The call being answered. */
  toolCallId: string;
}

export interface PersonaFrontendToolEntry {
  kind: PersonaFrontendToolKind;
  definition: PersonaFrontendToolDefinition;
  handler?: (
    args: Record<string, unknown>,
    ctx: PersonaFrontendToolContext,
  ) => unknown;
}

interface FrontendToolSlot extends PersonaFrontendToolEntry {
  id: symbol;
}

const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
};

/** Normalize `parameters` to a plain JSON Schema object (no `$schema` key). */
export function resolveToolParameters(
  parameters: PersonaToolParameters | undefined,
): Record<string, unknown> {
  let schema: unknown = parameters;
  if (
    parameters &&
    typeof (parameters as { toJSONSchema?: unknown }).toJSONSchema ===
      "function"
  ) {
    schema = (parameters as { toJSONSchema(): unknown }).toJSONSchema();
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return EMPTY_OBJECT_SCHEMA;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = schema as Record<string, unknown>;
  return { ...rest, type: "object" };
}

/**
 * Holds the tool renderers (`useRenderTool`) and frontend tools
 * (`useFrontendTool` / `useHumanInTheLoop` / `useComponent`) registered under
 * one `PersonaProvider`; a store compatible with `useSyncExternalStore`.
 */
export class PersonaToolRegistry {
  private renderers = new Map<string, RendererEntry>();
  private frontendTools = new Map<string, FrontendToolSlot>();
  private responders = new Map<string, (value: unknown) => void>();
  private listeners = new Set<() => void>();
  private version = 0;

  /**
   * Register a frontend tool. The latest registration for a name wins.
   * Returns an unregister function that only removes *this* registration.
   */
  registerFrontendTool(entry: PersonaFrontendToolEntry): () => void {
    const name = entry.definition.name;
    const slot: FrontendToolSlot = { ...entry, id: Symbol(name) };
    this.frontendTools.set(name, slot);
    this.emit();
    return () => {
      if (this.frontendTools.get(name)?.id === slot.id) {
        this.frontendTools.delete(name);
        this.emit();
      }
    };
  }

  getFrontendTool(name: string): PersonaFrontendToolEntry | undefined {
    return this.frontendTools.get(name);
  }

  /** Definitions to send with each run (empty → no `tools` sent at all). */
  getFrontendToolDefinitions(): PersonaFrontendToolDefinition[] {
    return Array.from(this.frontendTools.values(), (t) => t.definition);
  }

  /** Make `respond` available to the waiting human-in-the-loop call `toolCallId`. */
  setResponder(toolCallId: string, respond: (value: unknown) => void): void {
    this.responders.set(toolCallId, respond);
    this.emit();
  }

  clearResponder(toolCallId: string): void {
    if (this.responders.delete(toolCallId)) this.emit();
  }

  getResponder(toolCallId: string): ((value: unknown) => void) | undefined {
    return this.responders.get(toolCallId);
  }

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
