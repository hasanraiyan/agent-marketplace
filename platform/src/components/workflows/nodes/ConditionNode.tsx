"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranchIcon } from "@phosphor-icons/react";
import { NodeActionsToolbar } from "./NodeActionsToolbar";
import { nodeShellClass, NodeHeader } from "./nodeStyles";

export function ConditionNode({ id, data, selected }: NodeProps) {
  const nodeData = (data || {}) as {
    label?: string;
    description?: string;
    config?: { expression?: string };
    executionStatus?: "running" | "completed" | "failed";
  };

  const status = nodeData.executionStatus;

  return (
    <div className={`${nodeShellClass(selected, status)} min-w-[210px] max-w-[270px]`}>
      <NodeActionsToolbar nodeId={id} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-orange-500 hover:!scale-125 transition-transform"
      />

      <NodeHeader
        icon={<GitBranchIcon className="size-4" weight="fill" />}
        iconClassName="bg-orange-500/10 text-orange-500"
        label={nodeData.label || "Condition"}
        status={status}
      />

      <div className="flex flex-col gap-2.5 px-3.5 py-2.5">
        <p className="truncate text-[11px] text-muted-foreground">
          {nodeData.description || nodeData.config?.expression || "Branching decision"}
        </p>

        {/* True/false branch rows — each row's own handle sits at its right edge */}
        <div className="-mx-3.5 flex flex-col divide-y divide-border/50 border-t border-border/50">
          <div className="relative flex items-center justify-between px-3.5 py-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              True
            </span>
            <Handle
              id="true"
              type="source"
              position={Position.Right}
              style={{ position: "absolute", top: "50%", right: -12 }}
              className="!size-2.5 !border-2 !border-background !bg-emerald-500"
            />
          </div>
          <div className="relative flex items-center justify-between px-3.5 py-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-rose-600 dark:text-rose-400">
              <span className="size-1.5 rounded-full bg-rose-500" />
              False
            </span>
            <Handle
              id="false"
              type="source"
              position={Position.Right}
              style={{ position: "absolute", top: "50%", right: -12 }}
              className="!size-2.5 !border-2 !border-background !bg-rose-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
