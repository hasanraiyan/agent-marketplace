"use client";

import * as React from "react";
import {
  WrenchIcon,
  RobotIcon,
  WarningCircleIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Item, ItemMedia, ItemContent, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TodoChecklist } from "./todo-checklist";
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

/** One collapsible card for a single tool call — icon/label/status header, expandable args+result. */
function ToolCallCard({
  toolCall,
  todos,
  onOpenSubagent,
}: {
  toolCall: ChatToolCall;
  todos?: ChatTodo[];
  onOpenSubagent?: (toolCallId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isTask = toolCall.name === "task";
  const isTodos = toolCall.name === "write_todos";
  const isPending = toolCall.status === "running";
  const isError = toolCall.status === "error";
  const label = humanizeToolName(toolCall.name);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Item
        variant="outline"
        size="sm"
        className={cn(
          "flex-col items-stretch",
          isError && "border-destructive/30"
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
            ) : (
              <WrenchIcon />
            )}
          </ItemMedia>
          <ItemContent>
            <ItemTitle className={cn(isError && "text-destructive")}>
              {label}
              {isPending ? "…" : ""}
            </ItemTitle>
          </ItemContent>
          <CaretDownIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>

        {!open && isTodos && todos?.length ? (
          <div className="mt-2 pl-8">
            <TodoChecklist todos={todos} compact />
          </div>
        ) : null}

        <CollapsibleContent>
          <div className="mt-2.5 flex flex-col gap-2.5 border-t border-border pt-2.5">
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
