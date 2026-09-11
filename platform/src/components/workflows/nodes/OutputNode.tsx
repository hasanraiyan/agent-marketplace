"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { NodeActionsToolbar } from "./NodeActionsToolbar";

export function OutputNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { outputMapping?: string };
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
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-emerald-500 hover:!scale-125 transition-transform"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
          <CheckCircleIcon className="size-4" weight="fill" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {nodeData.label || "Output"}
          </span>
          <span className="text-[11px] text-muted-foreground truncate font-mono">
            {nodeData.config?.outputMapping || "Workflow Result"}
          </span>
        </div>
      </div>
    </div>
  );
}
