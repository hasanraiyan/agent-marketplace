"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BookOpenIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";

export function KnowledgeStepNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: {
      knowledgeBaseId?: string;
      topK?: number;
    };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div
      className={`relative min-w-[200px] max-w-[260px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
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
        className="!size-3 !border-2 !border-background !bg-cyan-500 hover:!scale-125 transition-transform"
      />

      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 mt-0.5">
          <BookOpenIcon className="size-4" weight="fill" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {nodeData.label || "Knowledge"}
            </span>
            <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
              Top {nodeData.config?.topK || 5}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            {nodeData.description || "Vector Search / RAG"}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-cyan-500 hover:!scale-125 transition-transform"
      />
    </div>
  );
}
