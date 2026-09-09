"use client";

import * as React from "react";
import {
  WrenchIcon,
  RobotIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TodoChecklist } from "./todo-checklist";
import { AgentUpsertBody, summarizeUpsert, type AgentUpsertSummary } from "./agent-upsert-card";
import type { ChatToolCall, ChatTodo } from "./types";

const TOOL_LABELS: Record<string, string> = {
  write_todos: "Planning next steps",
  task: "Delegating to a helper",
  present_file: "Sharing a file",
  read_file: "Reading a file",
  write_file: "Saving a file",
  edit_file: "Updating a file",
  ls: "Looking through files",
  glob: "Looking through files",
  grep: "Searching files",
};

function humanizeToolName(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatJson(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// write_todos's own args always carry the todos it was called with — read
// them directly instead of depending on the caller to thread a `todos` prop
// down. Some ChatMessage call sites (subagent-sheet, voice-tab,
// architect-chat) don't pass one at all, which left the card empty.
function parseTodosFromArgs(args: string | undefined): ChatTodo[] | undefined {
  if (!args) return undefined;
  try {
    const parsed = JSON.parse(args);
    return Array.isArray(parsed?.todos) ? parsed.todos : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One collapsible card for a single tool call — icon/label/status header,
 * expandable body. Every tool call renders through this same chrome; a tool
 * only changes what's *inside* it: write_todos replaces the raw Input/Result
 * entirely with a TodoChecklist (the plan itself is the only thing worth
 * showing — the raw JSON is noise), task adds a RobotIcon + "View subagent"
 * button, upsert_agent prepends an AgentUpsertBody summary above the raw
 * Input/Result every other tool shows. Never a second card.
 */
function ToolCallCard({
  toolCall,
  todos,
  onOpenSubagent,
  defaultOpen,
}: {
  toolCall: ChatToolCall;
  todos?: ChatTodo[];
  onOpenSubagent?: (toolCallId: string) => void;
  /** Overrides the initial expanded state (e.g. InterruptPanel forces this
   * open so the pending call's args are visible without an extra click). */
  defaultOpen?: boolean;
}) {
  const isTask = toolCall.name === "task";
  const isTodos = toolCall.name === "write_todos";
  const isUpsert = toolCall.name === "upsert_agent";
  const isPending = toolCall.status === "running";
  const upsert: AgentUpsertSummary | null = isUpsert ? summarizeUpsert(toolCall) : null;
  // A failed tool run or an envelope that reports status:"error" both count as
  // error; an upsert that returns status:"success" reads as a success.
  const isError = upsert ? upsert.isError : toolCall.status === "error";
  const upsertSucceeded = !!upsert?.succeeded;
  const label = upsert ? upsert.title : humanizeToolName(toolCall.name);
  // This call's own args win — they reflect the plan as of this specific
  // write_todos call; the externally-passed `todos` (the turn's latest
  // snapshot) is only a fallback for a call still streaming partial args.
  const displayTodos = isTodos ? (parseTodosFromArgs(toolCall.args) ?? todos) : undefined;
  // An upsert starts expanded while it runs so the "Writing…" state is visible.
  const [open, setOpen] = React.useState(defaultOpen ?? (isUpsert ? isPending : false));

  // write_todos stays collapsible like every other tool card, but the
  // checklist only renders once — inside CollapsibleContent — instead of
  // once as a "collapsed preview" and again as "expanded content" (that
  // duplication is what looked like a bug: same list either way).
  if (isTodos) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <Item variant="outline" size="sm" className="flex-col items-stretch">
          <CollapsibleTrigger
            render={
              <button type="button" className="flex w-full items-center gap-2.5 text-left" />
            }
          >
            <ItemMedia variant="icon">
              {isPending ? <Spinner className="text-primary" /> : <WrenchIcon />}
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {label}
                {isPending ? "…" : ""}
              </ItemTitle>
            </ItemContent>
            <CaretDownIcon
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            {displayTodos?.length ? (
              <div className="mt-2 pl-8">
                <TodoChecklist todos={displayTodos} />
              </div>
            ) : null}
          </CollapsibleContent>
        </Item>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Item
        variant="outline"
        size="sm"
        className={cn(
          "flex-col items-stretch",
          isError && "border-destructive/30",
          upsertSucceeded && "border-emerald-500/30"
        )}
      >
        <CollapsibleTrigger
          render={
            <button type="button" className="flex w-full items-center gap-2.5 text-left" />
          }
        >
          <ItemMedia variant="icon">
            {isError ? (
              <WarningCircleIcon className="text-destructive" />
            ) : isPending ? (
              <Spinner className="text-primary" />
            ) : isTask ? (
              <RobotIcon />
            ) : upsertSucceeded ? (
              <CheckCircleIcon className="text-emerald-500" />
            ) : (
              <WrenchIcon />
            )}
          </ItemMedia>
          <ItemContent>
            <ItemTitle
              className={cn(
                isError && "text-destructive",
                upsertSucceeded && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {label}
              {isPending ? "…" : ""}
            </ItemTitle>
            {upsert?.subtitle ? <ItemDescription>{upsert.subtitle}</ItemDescription> : null}
          </ItemContent>
          <CaretDownIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2.5 flex flex-col gap-2.5 border-t border-border pt-2.5">
            {/* An upsert gets its form-shaped summary first, but still falls
                through to the same raw Input/Result every other tool shows —
                one card, not a second one, per the module comment above. */}
            {isUpsert && upsert ? <AgentUpsertBody summary={upsert} /> : null}
            {toolCall.args && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Input</div>
                <pre className="max-h-32 overflow-auto rounded-none border border-border bg-muted p-2 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
                  {formatJson(toolCall.args)}
                </pre>
              </div>
            )}
            {toolCall.result && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Result</div>
                <pre
                  className={cn(
                    "max-h-40 overflow-auto rounded-none border p-2 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap",
                    isError
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-border bg-muted"
                  )}
                >
                  {formatJson(toolCall.result)}
                </pre>
              </div>
            )}
            {isTask && onOpenSubagent && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubagent(toolCall.id);
                }}
              >
                <RobotIcon /> View subagent
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Item>
    </Collapsible>
  );
}

export { ToolCallCard, humanizeToolName };
