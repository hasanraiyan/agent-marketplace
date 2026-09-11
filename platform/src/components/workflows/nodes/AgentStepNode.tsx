"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RobotIcon, ArrowsClockwiseIcon, SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

export function AgentStepNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: {
      agentId?: string;
      modelName?: string;
      pinSnapshot?: boolean;
      inputTemplate?: string;
    };
    retryPolicy?: { maxRetries?: number };
    executionStatus?: "running" | "completed" | "failed";
    liveTokenPreview?: string;
  };

  const status = nodeData.executionStatus;
  const maxRetries = nodeData.retryPolicy?.maxRetries || 0;
  const hasMeta = Boolean(nodeData.config?.pinSnapshot || maxRetries > 0 || nodeData.config?.modelName);

  return (
    <div className={`${nodeShellClass(selected, status)} min-w-[240px] max-w-[300px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-primary hover:!scale-125 transition-transform"
      />

      <NodeHeader
        icon={<RobotIcon className="size-4" weight="fill" />}
        iconClassName="bg-primary/10 text-primary"
        label={nodeData.label || "Agent Step"}
        status={status}
      />

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        <p className="truncate text-[11px] text-muted-foreground">
          {nodeData.description || "LLM Reasoning Step"}
        </p>

        {hasMeta && (
          <div className="flex flex-wrap items-center gap-1.5">
            {nodeData.config?.pinSnapshot && (
              <Badge variant="secondary" className="h-4 gap-0.5 px-1 font-mono text-[9px]">
                <SparkleIcon className="size-2.5 text-amber-500" />
                <span>Pinned</span>
              </Badge>
            )}
            {maxRetries > 0 && (
              <Badge variant="outline" className="h-4 gap-1 px-1 font-mono text-[9px] text-muted-foreground">
                <ArrowsClockwiseIcon className="size-2.5" />
                <span>{maxRetries}x</span>
              </Badge>
            )}
            {nodeData.config?.modelName && (
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {nodeData.config.modelName}
              </span>
            )}
          </div>
        )}

        {nodeData.liveTokenPreview && (
          <p className="line-clamp-2 rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground italic">
            {nodeData.liveTokenPreview}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-primary hover:!scale-125 transition-transform"
      />
    </div>
  );
}
