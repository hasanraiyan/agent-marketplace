"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { LightningIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";

export function TriggerNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { type?: string };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div
      className={`relative min-w-[200px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
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
      <NodeActionsToolbar nodeId={id} selected={selected} allowDuplicate={false} preventDeleteIfOnly />
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
          <LightningIcon className="size-4" weight="fill" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {nodeData.label || "Trigger"}
            </span>
            <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono uppercase">
              {nodeData.config?.type || "manual"}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            {nodeData.description || "Entry point"}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-amber-500 hover:!scale-125 transition-transform"
      />
    </div>
  );
}
