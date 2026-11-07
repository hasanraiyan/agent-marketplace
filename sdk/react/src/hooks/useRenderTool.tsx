"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type { PersonaToolCall } from "../types.js";
import {
  buildToolRenderProps,
  type PersonaToolRenderFn,
  type PersonaToolRenderProps,
} from "../tools/registry.js";

export interface UseRenderToolConfig<TArgs = Record<string, unknown>> {
  /** The tool to render — a server tool's name, or `"*"` for any tool without its own renderer. */
  name: string;
  /** Called on every update of a matching call; `status` tells you which fields are filled. */
  render: PersonaToolRenderFn<TArgs>;
}

/**
 * Render a component for a tool call that runs on the server (MCP, REST API
 * tool, built-in…) instead of the generic tool card. Display only: the tool
 * itself is unchanged.
 *
 * Registered while the calling component is mounted; the latest registration
 * for a name wins. Show calls with `<PersonaToolCallView toolCall={tc} />`
 * or `useRenderToolCall()`.
 *
 * ```tsx
 * useRenderTool<{ query: string }>({
 *   name: "search_programs",
 *   render: ({ status, args, result }) =>
 *     status === "complete" ? <ProgramResults json={result} /> : <Searching query={args.query} />,
 * });
 * ```
 */
export function useRenderTool<TArgs = Record<string, unknown>>(
  config: UseRenderToolConfig<TArgs>,
): void {
  const { toolRegistry, logger } = usePersonaContext();
  // Always call the latest render function without re-registering (and
  // re-rendering every tool view) on each render of the caller.
  const renderRef = useRef(config.render);
  renderRef.current = config.render;
  const { name } = config;

  useEffect(() => {
    if (!name) return;
    if (toolRegistry.hasRenderer(name)) {
      logger.warn("useRenderTool: replacing an existing renderer", { name });
    }
    logger.debug("useRenderTool registered", { name });
    return toolRegistry.registerRenderer(name, (props) =>
      renderRef.current(props as PersonaToolRenderProps<TArgs>),
    );
  }, [name, toolRegistry, logger]);
}

/**
 * Hosts one render call as its own component, so render functions may use
 * hooks, and each tool call keeps its own state across updates.
 */
function ToolRenderHost({
  render,
  props,
}: {
  render: PersonaToolRenderFn;
  props: PersonaToolRenderProps;
}): React.ReactElement {
  return <>{render(props)}</>;
}

/**
 * Returns a function that renders a tool call with its registered renderer
 * (falling back to the `"*"` wildcard). It returns `undefined` when no
 * renderer matches, so you can show your own default card.
 */
export function useRenderToolCall(): (
  toolCall: PersonaToolCall,
) => React.ReactElement | undefined {
  const { toolRegistry } = usePersonaContext();
  const version = useSyncExternalStore(
    toolRegistry.subscribe,
    toolRegistry.getVersion,
    toolRegistry.getVersion,
  );

  return useCallback(
    (toolCall: PersonaToolCall) => {
      const render = toolRegistry.getRenderer(toolCall.toolName);
      if (!render) return undefined;
      return (
        <ToolRenderHost
          key={toolCall.toolCallId}
          render={render}
          props={buildToolRenderProps(toolCall)}
        />
      );
    },
    // `version` re-creates the function when renderers change.
    [toolRegistry, version],
  );
}

export interface PersonaToolCallViewProps {
  toolCall: PersonaToolCall;
  /** Shown when no renderer (and no `"*"` wildcard) is registered for this tool. */
  fallback?: ReactNode;
}

/**
 * Renders one tool call with its `useRenderTool` renderer, or `fallback`.
 *
 * ```tsx
 * {message.toolCalls?.map((tc) => (
 *   <PersonaToolCallView key={tc.toolCallId} toolCall={tc} fallback={<ToolCard call={tc} />} />
 * ))}
 * ```
 */
export function PersonaToolCallView({
  toolCall,
  fallback = null,
}: PersonaToolCallViewProps) {
  const renderToolCall = useRenderToolCall();
  const node = renderToolCall(toolCall);
  return <>{node ?? fallback}</>;
}
