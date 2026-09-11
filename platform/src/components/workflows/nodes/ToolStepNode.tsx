"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { WrenchIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

export function ToolStepNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: {
      toolName?: string;
      toolType?: "rcp" | "rest" | "mcp";
    };
    retryPolicy?: { maxRetries?: number };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;
  const maxRetries = nodeData.retryPolicy?.maxRetries || 0;

  return (
    <div className={`${nodeShellClass(selected, status)} min-w-[220px] max-w-[280px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-violet-500 hover:!scale-125 transition-transform"
      />

      <NodeHeader
        icon={<WrenchIcon className="size-4" weight="fill" />}
        iconClassName="bg-violet-500/10 text-violet-500"
        label={nodeData.label || "Tool Step"}
        status={status}
      />

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-muted-foreground">
            {nodeData.description || nodeData.config?.toolName || "Deterministic call"}
          </p>
          <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[9px] uppercase">
            {nodeData.config?.toolType || "tool"}
          </Badge>
        </div>

        {maxRetries > 0 && (
          <Badge variant="outline" className="h-4 w-fit gap-1 px-1 font-mono text-[9px] text-muted-foreground">
            <ArrowsClockwiseIcon className="size-2.5" />
            <span>{maxRetries}x</span>
          </Badge>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-violet-500 hover:!scale-125 transition-transform"
      />
    </div>
  );
}
