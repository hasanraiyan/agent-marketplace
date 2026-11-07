"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import {
  resolveToolParameters,
  type PersonaFrontendToolContext,
  type PersonaFrontendToolKind,
  type PersonaToolParameters,
  type PersonaToolRenderFn,
  type PersonaToolRenderProps,
} from "../tools/registry.js";

interface FrontendToolConfigBase {
  /** Tool name the agent calls — `^[a-zA-Z0-9_-]{1,64}$`, unique, not a server tool's name. */
  name: string;
  /** What the tool does and when to use it. The model reads this. */
  description: string;
  /** JSON Schema of the arguments (or anything with `toJSONSchema()`). Omit for no arguments. */
  parameters?: PersonaToolParameters;
}

export interface UseFrontendToolConfig<
  TArgs = Record<string, unknown>,
> extends FrontendToolConfigBase {
  /**
   * Runs in the browser when the agent calls the tool. The return value (any
   * JSON value) goes back to the agent; a thrown error is reported as the
   * tool failing.
   */
  handler: (args: TArgs, ctx: PersonaFrontendToolContext) => unknown;
  /** Optional UI for the call in the transcript (same props as `useRenderTool`). */
  render?: PersonaToolRenderFn<TArgs>;
}

export interface UseHumanInTheLoopConfig<
  TArgs = Record<string, unknown>,
> extends FrontendToolConfigBase {
  /**
   * UI that asks the user. While waiting (`status: "executing"`) it gets
   * `respond(value)` — call it once; `value` is what the agent receives.
   */
  render: PersonaToolRenderFn<TArgs>;
}

export interface UseComponentConfig<
  TArgs = Record<string, unknown>,
> extends FrontendToolConfigBase {
  /**
   * The component to show, called with the tool's arguments (partial while
   * they stream in). The agent is told it was displayed.
   */
  render: (
    args: Partial<TArgs>,
    props: PersonaToolRenderProps<TArgs>,
  ) => ReactNode;
}

/**
 * Shared registration: definition (re-registered only when name /
 * description / schema change) + latest handler/render via refs.
 */
function useRegisterFrontendTool<TArgs>(
  kind: PersonaFrontendToolKind,
  config: FrontendToolConfigBase,
  handler:
    ((args: TArgs, ctx: PersonaFrontendToolContext) => unknown) | undefined,
  render: PersonaToolRenderFn<TArgs> | undefined,
): void {
  const { toolRegistry, logger } = usePersonaContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const renderRef = useRef(render);
  renderRef.current = render;
  const hasRender = !!render;

  const { name, description } = config;
  // Serialized so an inline `parameters` object literal doesn't re-register
  // on every render — only an actual schema change does.
  const schemaJson = JSON.stringify(resolveToolParameters(config.parameters));

  useEffect(() => {
    if (!name) return;
    if (toolRegistry.getFrontendTool(name)) {
      logger.warn("frontend tool: replacing an existing registration", {
        name,
      });
    }
    logger.debug("frontend tool registered", { name, kind });
    const offTool = toolRegistry.registerFrontendTool({
      kind,
      definition: { name, description, parameters: JSON.parse(schemaJson) },
      handler:
        kind === "handler"
          ? (args, ctx) => handlerRef.current?.(args as TArgs, ctx)
          : undefined,
    });
    const offRender = hasRender
      ? toolRegistry.registerRenderer(name, (props) =>
          renderRef.current?.(props as PersonaToolRenderProps<TArgs>),
        )
      : undefined;
    return () => {
      offTool();
      offRender?.();
    };
  }, [toolRegistry, logger, kind, name, description, schemaJson, hasRender]);
}

/**
 * Give the agent a tool that runs in the user's browser — navigate, open a
 * modal, read local state, call your own client API… The agent must have
 * **Frontend Tools** enabled; otherwise it never sees the tool.
 *
 * `useChat` sends registered tools with every message, runs `handler` when
 * the agent calls the tool, and resumes the agent with the result.
 *
 * ```tsx
 * useFrontendTool<{ programId: string }>({
 *   name: "open_program",
 *   description: "Open a program's detail page for the student.",
 *   parameters: { type: "object", properties: { programId: { type: "string" } }, required: ["programId"] },
 *   handler: ({ programId }) => { router.push(`/programs/${programId}`); return "opened"; },
 * });
 * ```
 */
export function useFrontendTool<TArgs = Record<string, unknown>>(
  config: UseFrontendToolConfig<TArgs>,
): void {
  useRegisterFrontendTool<TArgs>(
    "handler",
    config,
    config.handler,
    config.render,
  );
}

/**
 * A frontend tool that asks the user and waits: `render` shows your UI and
 * gets `respond(value)` while the agent is waiting. The agent continues once
 * you call it.
 *
 * ```tsx
 * useHumanInTheLoop<{ university: string }>({
 *   name: "confirm_application",
 *   description: "Ask the student to confirm before submitting an application.",
 *   parameters: { type: "object", properties: { university: { type: "string" } } },
 *   render: ({ args, status, respond }) => (
 *     <ConfirmCard
 *       title={`Apply to ${args.university}?`}
 *       disabled={status !== "executing" || !respond}
 *       onYes={() => respond?.({ confirmed: true })}
 *       onNo={() => respond?.({ confirmed: false })}
 *     />
 *   ),
 * });
 * ```
 */
export function useHumanInTheLoop<TArgs = Record<string, unknown>>(
  config: UseHumanInTheLoopConfig<TArgs>,
): void {
  useRegisterFrontendTool<TArgs>(
    "humanInTheLoop",
    config,
    undefined,
    config.render,
  );
}

/**
 * Generative UI: let the agent show one of your components in the chat. The
 * tool's arguments become the component's props; the agent is told it was
 * displayed and carries on.
 *
 * ```tsx
 * useComponent<{ items: Program[] }>({
 *   name: "show_shortlist",
 *   description: "Show the student's program shortlist as cards.",
 *   parameters: shortlistSchema,
 *   render: (args) => <ShortlistCards items={args.items ?? []} />,
 * });
 * ```
 */
export function useComponent<TArgs = Record<string, unknown>>(
  config: UseComponentConfig<TArgs>,
): void {
  const renderRef = useRef(config.render);
  renderRef.current = config.render;
  // Stable wrapper (identity never changes) — the latest `render` is read
  // through the ref, so this never triggers a re-registration.
  const wrapperRef = useRef<PersonaToolRenderFn<TArgs>>((props) =>
    renderRef.current(props.args as Partial<TArgs>, props),
  );
  useRegisterFrontendTool<TArgs>(
    "component",
    config,
    undefined,
    wrapperRef.current,
  );
}
