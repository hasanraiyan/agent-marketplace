"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { LightningIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

export function TriggerNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { type?: string };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div className={`${nodeShellClass(selected, status)} min-w-[200px] max-w-[260px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} allowDuplicate={false} preventDeleteIfOnly />

      <NodeHeader
        icon={<LightningIcon className="size-4" weight="fill" />}
        iconClassName="bg-amber-500/10 text-amber-500"
        label={nodeData.label || "Trigger"}
        status={status}
      />

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-muted-foreground">
            {nodeData.description || "Entry point"}
          </p>
          <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[9px] uppercase">
            {nodeData.config?.type || "manual"}
          </Badge>
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
