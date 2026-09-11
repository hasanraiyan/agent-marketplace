"use client";

import * as React from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

// Registered as the `default` edge type (WorkflowCanvas.tsx) so every
// existing edge — none of which carry an explicit `type` — renders through
// this component automatically. Shows a small delete button at the edge's
// midpoint once the edge is selected (click the line), the same
// select-then-act pattern nodes already use via NodeActionsToolbar, rather
// than a hover-only affordance that's easy to lose while aiming at a thin
// bezier curve.
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : (style as { strokeWidth?: number })?.strokeWidth || 1.5,
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <Button
            size="icon-xs"
            variant="outline"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            title="Delete connection"
            aria-label="Delete connection"
            onClick={(e) => {
              e.stopPropagation();
              deleteElements({ edges: [{ id }] });
            }}
            className="rounded-full text-muted-foreground shadow-sm hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <XIcon weight="bold" />
          </Button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
