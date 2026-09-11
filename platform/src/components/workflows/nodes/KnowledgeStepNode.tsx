"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BookOpenIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

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
    <div className={`${nodeShellClass(selected, status)} min-w-[220px] max-w-[280px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-cyan-500 hover:!scale-125 transition-transform"
      />

      <NodeHeader
        icon={<BookOpenIcon className="size-4" weight="fill" />}
        iconClassName="bg-cyan-500/10 text-cyan-500"
        label={nodeData.label || "Knowledge"}
        status={status}
      />

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-muted-foreground">
            {nodeData.description || "Vector Search / RAG"}
          </p>
          <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[9px]">
            Top {nodeData.config?.topK || 5}
          </Badge>
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
