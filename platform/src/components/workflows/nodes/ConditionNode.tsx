"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranchIcon } from "@phosphor-icons/react";

export function ConditionNode({ data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { mode?: string };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div
      className={`relative min-w-[180px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
        selected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border hover:border-foreground/30"
      } ${
        status === "running"
          ? "border-blue-500 ring-2 ring-blue-500/30 animate-pulse"
          : status === "completed"
          ? "border-emerald-500"
          : status === "failed"
          ? "border-destructive"
          : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-orange-500 hover:!scale-125 transition-transform"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
          <GitBranchIcon className="size-4" weight="fill" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {nodeData.label || "Condition"}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {nodeData.description || "Branching Decision"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 items-end pr-1 text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5 relative">
          <span>True</span>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: "auto", right: -12 }}
            className="!size-2.5 !border-2 !border-background !bg-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1.5 relative mt-1">
          <span>False</span>
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: "auto", right: -12 }}
            className="!size-2.5 !border-2 !border-background !bg-rose-500"
          />
        </div>
      </div>
    </div>
  );
}
