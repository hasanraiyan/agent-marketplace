"use client";

import { CircleCheck, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// Dostify-style plan status icons: filled accent check-circle for completed,
// a clock (timelapse) for the step in progress, an empty circle for pending.
export function TodoStatusIcon({ status }) {
  if (status === "completed") {
    return (
      <CircleCheck className="size-[15px] shrink-0 fill-[#1E60FF] text-white" />
    );
  }
  if (status === "in_progress") {
    return <Clock className="size-[15px] shrink-0 text-[#1E60FF]" />;
  }
  return (
    <Circle className="size-[15px] shrink-0 text-slate-300 dark:text-slate-600" />
  );
}

// Dostify-style plan list: bare, tightly-spaced rows — no bordered cards, no
// progress bar. Completed steps strike through and fade; the in-progress step
// is semibold; pending steps stay quiet.
export function TodoChecklist({ todos, className }) {
  if (!todos?.length) return null;

  return (
    <ul className={cn("space-y-0", className)}>
      {todos.map((todo, index) => {
        const isCompleted = todo.status === "completed";
        const isInProgress = todo.status === "in_progress";

        return (
          <li
            key={`${index}-${todo.content}`}
            className="flex items-start gap-2 py-[3px]"
          >
            <span className="mt-px shrink-0">
              <TodoStatusIcon status={todo.status} />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-[12.5px] leading-5",
                isCompleted
                  ? "text-slate-400 line-through dark:text-slate-500"
                  : isInProgress
                    ? "font-semibold text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-300",
              )}
            >
              {todo.content}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
