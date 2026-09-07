"use client";

import * as React from "react";
import { CheckIcon, CircleIcon, CircleDashedIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ChatTodo } from "./types";

function TodoChecklist({
  todos,
  compact = false,
}: {
  todos: ChatTodo[];
  compact?: boolean;
}) {
  if (!todos?.length) return null;

  return (
    <ul className={cn("flex flex-col gap-1", compact ? "gap-0.5" : "gap-1")}>
      {todos.map((todo, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-2 text-xs",
            todo.status === "completed" && "text-muted-foreground line-through",
            todo.status === "in_progress" && "text-foreground font-medium"
          )}
        >
          <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
            {todo.status === "completed" ? (
              <CheckIcon className="size-3.5 text-primary" />
            ) : todo.status === "in_progress" ? (
              <CircleDashedIcon className="size-3.5 animate-spin text-primary" />
            ) : (
              <CircleIcon className="size-3.5 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0 flex-1 wrap-break-word">{todo.content}</span>
        </li>
      ))}
    </ul>
  );
}

export { TodoChecklist };
