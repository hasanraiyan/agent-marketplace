"use client";

import * as React from "react";
import { NodeToolbar, Position, useReactFlow, type Node } from "@xyflow/react";
import { TrashIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface NodeActionsToolbarProps {
  nodeId: string;
  selected?: boolean;
  /** Hide the duplicate action — e.g. Trigger, since a workflow may only have one. */
  allowDuplicate?: boolean;
}

// Shared floating action bar for every workflow node type — appears above a
// selected node (React Flow's NodeToolbar portals it outside the node's own
// drag/click handling, so these clicks never get mistaken for a node drag or
// bubble into onNodeClick). One definition, reused by every node component,
// so delete/duplicate behave identically everywhere instead of drifting
// per node type.
export function NodeActionsToolbar({ nodeId, selected, allowDuplicate = true }: NodeActionsToolbarProps) {
  const { deleteElements, getNode, setNodes } = useReactFlow();

  const handleDuplicate = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const node = getNode(nodeId) as Node | undefined;
      if (!node) return;
      const newId = `${node.type}_${Date.now()}`;
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        {
          ...node,
          id: newId,
          position: { x: node.position.x + 48, y: node.position.y + 48 },
          selected: true,
          data: {
            ...(node.data as Record<string, unknown>),
            label: `${((node.data as { label?: string })?.label) || "Node"} (copy)`,
          },
        },
      ]);
    },
    [getNode, nodeId, setNodes]
  );

  const handleDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteElements({ nodes: [{ id: nodeId }] });
    },
    [deleteElements, nodeId]
  );

  return (
    <NodeToolbar
      isVisible={selected}
      position={Position.Top}
      offset={10}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-md"
    >
      {allowDuplicate && (
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleDuplicate}
          title="Duplicate (Ctrl+D)"
          aria-label="Duplicate node"
          className="rounded-md"
        >
          <CopyIcon />
        </Button>
      )}
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleDelete}
        title="Delete (Del)"
        aria-label="Delete node"
        className="rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <TrashIcon />
      </Button>
    </NodeToolbar>
  );
}
