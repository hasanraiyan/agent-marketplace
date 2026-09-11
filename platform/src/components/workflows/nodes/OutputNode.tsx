"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

export function OutputNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { outputMapping?: string; outputType?: "text" | "json" };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div className={`${nodeShellClass(selected, status)} min-w-[200px] max-w-[260px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-emerald-500 hover:!scale-125 transition-transform"
      />

      <NodeHeader
        icon={<CheckCircleIcon className="size-4" weight="fill" />}
        iconClassName="bg-emerald-500/10 text-emerald-500"
        label={nodeData.label || "Output"}
        status={status}
      />

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {nodeData.config?.outputMapping || "Workflow Result"}
          </p>
          <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[9px] uppercase">
            {nodeData.config?.outputType || "text"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
