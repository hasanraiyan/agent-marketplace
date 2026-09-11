"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  StopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
  ShieldCheckIcon,
  ClockIcon,
  CoinsIcon,
} from "@phosphor-icons/react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TriggerNode } from "@/components/workflows/nodes/TriggerNode";
import { AgentStepNode } from "@/components/workflows/nodes/AgentStepNode";
import { ToolStepNode } from "@/components/workflows/nodes/ToolStepNode";
import { KnowledgeStepNode } from "@/components/workflows/nodes/KnowledgeStepNode";
import { ConditionNode } from "@/components/workflows/nodes/ConditionNode";
import { OutputNode } from "@/components/workflows/nodes/OutputNode";
import {
  getProjectWorkflow,
  getProjectWorkflowRun,
  cancelProjectWorkflowRun,
} from "@/lib/api/projects";

const nodeTypes = {
  trigger: TriggerNode,
  agentStep: AgentStepNode,
  toolStep: ToolStepNode,
  knowledgeStep: KnowledgeStepNode,
  condition: ConditionNode,
  output: OutputNode,
};

export default function WorkflowRunInspectorPage() {
  const { projectId, workflowId, runId } = useParams<{
    projectId: string;
    workflowId: string;
    runId: string;
  }>();

  const [workflow, setWorkflow] = React.useState<any | null>(null);
  const [run, setRun] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState(false);

  // Inspector sheet for clicked node
  const [selectedNodeRun, setSelectedNodeRun] = React.useState<any | null>(null);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [wfRes, runRes] = await Promise.all([
        getProjectWorkflow(projectId, workflowId),
        getProjectWorkflowRun(projectId, runId),
      ]);
      setWorkflow(wfRes.data?.data || null);
      setRun(runRes.data?.data || null);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId, runId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // If run is running, poll or stream telemetry updates
  React.useEffect(() => {
    if (!run || run.status !== "running") return;

    const interval = setInterval(async () => {
      try {
        const res = await getProjectWorkflowRun(projectId, runId);
        const updated = res.data?.data;
        if (updated) {
          setRun(updated);
          if (updated.status !== "running") {
            clearInterval(interval);
          }
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, runId, run?.status]);

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await cancelProjectWorkflowRun(projectId, runId);
      await loadData();
    } catch {
    } finally {
      setCancelling(false);
    }
  };

  // Build nodes with execution status badges applied from run.nodeRuns
  const nodesWithStatus: Node[] = React.useMemo(() => {
    const baseNodes: Node[] = workflow?.draft?.nodes || [];
    const nodeRunsMap = new Map((run?.nodeRuns || []).map((nr: any) => [nr.nodeId, nr]));

    return baseNodes.map((n) => {
      const nr = nodeRunsMap.get(n.id) as any;
      return {
        ...n,
        data: {
          ...(n.data as any),
          executionStatus: nr?.status || "idle",
        },
      };
    });
  }, [workflow, run]);

  const edges: Edge[] = React.useMemo(() => {
    return workflow?.draft?.edges || [];
  }, [workflow]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const nr = (run?.nodeRuns || []).find((r: any) => r.nodeId === node.id);
    setSelectedNodeRun({
      node,
      nodeRun: nr,
    });
    setInspectorOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-65px)] w-full items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const duration =
    run?.startedAt && run?.endedAt
      ? `${Math.round(
          (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
        )}s`
      : "—";

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full relative bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-14 border-b border-border px-4 flex items-center justify-between bg-card/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs -ml-1 text-muted-foreground"
            render={<Link href={`/projects/${projectId}/workflows/${workflowId}/runs`} />}
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Runs</span>
          </Button>

          <span className="text-muted-foreground">/</span>
          <span className="font-mono text-xs text-foreground truncate max-w-xs">{runId}</span>

          <Badge
            variant={
              run?.status === "completed"
                ? "secondary"
                : run?.status === "running"
                ? "default"
                : "outline"
            }
            className={`text-[10px] font-mono capitalize ${
              run?.status === "completed"
                ? "text-emerald-500 bg-emerald-500/10"
                : run?.status === "running"
                ? "text-blue-500 bg-blue-500/10 animate-pulse"
                : run?.status === "cancelled"
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {run?.status}
          </Badge>

          {run?.isDryRun && (
            <Badge variant="outline" className="text-[10px] font-mono gap-1 text-emerald-600 border-emerald-500/30">
              <ShieldCheckIcon className="size-2.5" />
              <span>Dry Run</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              <span>{duration}</span>
            </span>
            <span>{run?.usage?.totalTokens?.toLocaleString() || 0} tokens</span>
            <span>
              {run?.isDryRun ? "0 credits (Exempt)" : `${run?.usage?.creditsDeducted || 0} credits`}
            </span>
          </div>

          {run?.status === "running" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={cancelling}
              onClick={handleCancel}
              className="h-8 gap-1.5 text-xs"
            >
              <StopIcon className="size-3.5" weight="fill" />
              <span>{cancelling ? "Stopping..." : "Cancel Run"}</span>
            </Button>
          )}
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodesWithStatus}
          edges={edges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          className="bg-muted/10"
        >
          <Background gap={16} size={1} />
          <Controls className="!bg-card !border-border !shadow-sm fill-foreground" />
          <MiniMap className="!bg-card !border-border !rounded-lg" />
        </ReactFlow>
      </div>

      {/* Node Detail Inspector Sheet */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6 space-y-6">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono uppercase">
                {selectedNodeRun?.node?.type || "node"}
              </Badge>
              {selectedNodeRun?.nodeRun?.status && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono capitalize ${
                    selectedNodeRun.nodeRun.status === "completed"
                      ? "text-emerald-500 border-emerald-500/30"
                      : selectedNodeRun.nodeRun.status === "running"
                      ? "text-blue-500 border-blue-500/30"
                      : "text-destructive border-destructive/30"
                  }`}
                >
                  {selectedNodeRun.nodeRun.status}
                </Badge>
              )}
            </div>
            <SheetTitle className="text-base font-semibold">
              {selectedNodeRun?.node?.data?.label || selectedNodeRun?.node?.id}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Step execution diagnostics, inputs, and results.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <span className="text-muted-foreground text-[10px]">Duration</span>
                <p className="font-semibold text-foreground">
                  {selectedNodeRun?.nodeRun?.durationMs ?? 0}ms
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Retries Taken</span>
                <p className="font-semibold text-foreground">
                  {selectedNodeRun?.nodeRun?.retriesTaken ?? 0}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Tokens Used</span>
                <p className="font-semibold text-foreground">
                  {selectedNodeRun?.nodeRun?.tokens ?? 0}
                </p>
              </div>
            </div>

            {selectedNodeRun?.nodeRun?.error && (
              <div className="space-y-1">
                <span className="text-destructive font-semibold text-[11px]">Error Message:</span>
                <pre className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] whitespace-pre-wrap">
                  {selectedNodeRun.nodeRun.error}
                </pre>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold text-[11px]">Input Payload:</span>
              <pre className="p-2.5 rounded bg-muted/40 border border-border text-[11px] overflow-x-auto max-h-40">
                {JSON.stringify(
                  selectedNodeRun?.nodeRun?.input || selectedNodeRun?.node?.data?.config || {},
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold text-[11px]">Output Payload:</span>
              <pre className="p-2.5 rounded bg-muted/40 border border-border text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedNodeRun?.nodeRun?.output || "(No output)", null, 2)}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
