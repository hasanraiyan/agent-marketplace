"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RobotIcon, ArrowsClockwiseIcon, SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

export function AgentStepNode({ data, selected }: NodeProps) {
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

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
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
        className="!size-3 !border-2 !border-background !bg-primary hover:!scale-125 transition-transform"
      />

      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
          <RobotIcon className="size-4" weight="fill" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {nodeData.label || "Agent Step"}
            </span>
            {nodeData.config?.pinSnapshot && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 gap-0.5 font-mono">
                <SparkleIcon className="size-2.5 text-amber-500" />
                <span>Pinned</span>
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            {nodeData.description || "LLM Reasoning Step"}
          </span>

          <div className="flex items-center gap-1.5 mt-2">
            {maxRetries > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 text-muted-foreground font-mono">
                <ArrowsClockwiseIcon className="size-2.5" />
                <span>{maxRetries}x</span>
              </Badge>
            )}
            {nodeData.config?.modelName && (
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {nodeData.config.modelName}
              </span>
            )}
          </div>
        </div>
      </div>

      {nodeData.liveTokenPreview && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-mono text-muted-foreground line-clamp-2 italic bg-muted/40 p-1.5 rounded">
            {nodeData.liveTokenPreview}
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-primary hover:!scale-125 transition-transform"
      />
    </div>
  );
}
