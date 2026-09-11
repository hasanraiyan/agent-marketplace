"use client";

import * as React from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  FloppyDiskIcon,
  UploadSimpleIcon,
  PlayIcon,
  CodeIcon,
  ClockCounterClockwiseIcon,
  PlusIcon,
  RobotIcon,
  WrenchIcon,
  BookOpenIcon,
  LightningIcon,
  GitBranchIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TriggerNode } from "./nodes/TriggerNode";
import { AgentStepNode } from "./nodes/AgentStepNode";
import { ToolStepNode } from "./nodes/ToolStepNode";
import { KnowledgeStepNode } from "./nodes/KnowledgeStepNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { OutputNode } from "./nodes/OutputNode";
import { DeletableEdge } from "./edges/DeletableEdge";
import { NodeConfigDrawer } from "./NodeConfigDrawer";
import { TestRunDrawer } from "./TestRunDrawer";
import { MermaidExportDialog } from "./MermaidExportDialog";
import {
  saveProjectWorkflowDraft,
  publishProjectWorkflow,
  getProjectWorkflowMermaid,
} from "@/lib/api/projects";
import { getApiErrorMessage } from "@/lib/api/core";

const nodeTypes = {
  trigger: TriggerNode,
  agentStep: AgentStepNode,
  toolStep: ToolStepNode,
  knowledgeStep: KnowledgeStepNode,
  condition: ConditionNode,
  output: OutputNode,
};

// Every edge from the backend/draft carries no explicit `type`, so
// registering this as `default` routes all of them through DeletableEdge
// without needing to stamp a type onto each one.
const edgeTypes = {
  default: DeletableEdge,
};

interface WorkflowCanvasProps {
  projectId: string;
  workflow: any;
  onRefresh?: () => void;
}

export function WorkflowCanvas({ projectId, workflow, onRefresh }: WorkflowCanvasProps) {
  const initialNodes = workflow?.draft?.nodes || [];
  const initialEdges = workflow?.draft?.edges || [];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  const [isDirty, setIsDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  // Drawers and Dialogs
  const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = React.useState(false);
  const [testDrawerOpen, setTestDrawerOpen] = React.useState(false);
  const [mermaidDialogOpen, setMermaidDialogOpen] = React.useState(false);
  const [mermaidText, setMermaidText] = React.useState("");
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && navigator.platform?.includes("Mac"));
  }, []);

  const onConnect = React.useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, id: `e_${Date.now()}` }, eds));
      setIsDirty(true);
    },
    [setEdges]
  );

  // Mark dirty on node or edge updates
  const handleNodesChange = (changes: any) => {
    onNodesChange(changes);
    setIsDirty(true);
  };

  const handleEdgesChange = (changes: any) => {
    onEdgesChange(changes);
    setIsDirty(true);
  };

  const onReconnect = React.useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) =>
        els.map((edge) =>
          edge.id === oldEdge.id
            ? { ...edge, source: newConnection.source, target: newConnection.target, sourceHandle: newConnection.sourceHandle, targetHandle: newConnection.targetHandle }
            : edge
        )
      );
      setIsDirty(true);
    },
    [setEdges]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  };

  // Blocks deleting the last Trigger node — via the toolbar button (which
  // NodeActionsToolbar also disables directly) AND the Del/Backspace
  // keyboard shortcut, which the button can't intercept on its own. Runs
  // for every deletion path since React Flow calls this before actually
  // removing anything, whether triggered by deleteKeyCode or deleteElements().
  const onBeforeDelete = React.useCallback(
    async ({ nodes: toDelete, edges: edgesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      const triggerCount = nodes.filter((n) => n.type === "trigger").length;
      const deletingTrigger = toDelete.some((n) => n.type === "trigger");
      if (deletingTrigger && triggerCount <= 1) {
        setMessage({
          text: "Every workflow needs exactly one Trigger — add a new one before removing this.",
          type: "error",
        });
        setTimeout(() => setMessage(null), 4000);
        return { nodes: toDelete.filter((n) => n.type !== "trigger"), edges: edgesToDelete };
      }
      return true;
    },
    [nodes]
  );

  const handleDuplicateSelected = React.useCallback(() => {
    setNodes((nds) => {
      const target = nds.find((n) => n.selected);
      if (!target || target.type === "trigger") return nds;
      const newId = `${target.type}_${Date.now()}`;
      return [
        ...nds.map((n) => ({ ...n, selected: false })),
        {
          ...target,
          id: newId,
          position: { x: target.position.x + 48, y: target.position.y + 48 },
          selected: true,
          data: {
            ...(target.data as Record<string, unknown>),
            label: `${((target.data as { label?: string })?.label) || "Node"} (copy)`,
          },
        },
      ];
    });
    setIsDirty(true);
  }, [setNodes]);

  // Canvas-wide keyboard shortcuts. Skipped while typing in a form field
  // (config drawer, palette search, etc.) so Escape/Ctrl+D don't fight with
  // normal text editing — deleteKeyCode above already gets this guard for
  // free from React Flow itself, but these two are hand-rolled.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Escape") {
        if (configDrawerOpen) setConfigDrawerOpen(false);
        return;
      }

      if (!isTyping && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [configDrawerOpen, handleDuplicateSelected]);

  const handleUpdateNode = (nodeId: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: updatedData } : n))
    );
    setIsDirty(true);
  };

  // Add node from palette
  const handleAddNode = (type: string, label: string) => {
    const id = `${type}_${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: {
        x: 200 + Math.random() * 200,
        y: 150 + Math.random() * 150,
      },
      data: {
        label,
        description: "",
        config: {},
        retryPolicy: { maxRetries: 0, backoffMs: 1000, exponential: true },
        onError: "fail",
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setIsDirty(true);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await saveProjectWorkflowDraft(projectId, workflow._id, {
        nodes,
        edges,
        trigger: workflow.draft?.trigger || { type: "manual" },
      });
      setIsDirty(false);
      setMessage({ text: "Draft saved successfully", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        text: getApiErrorMessage(err, "Failed to save draft"),
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    setIsPublishing(true);
    setMessage(null);
    try {
      // Save draft first if dirty
      if (isDirty) {
        await saveProjectWorkflowDraft(projectId, workflow._id, {
          nodes,
          edges,
          trigger: workflow.draft?.trigger || { type: "manual" },
        });
        setIsDirty(false);
      }
      await publishProjectWorkflow(projectId, workflow._id);
      setMessage({ text: "Published as new version!", type: "success" });
      onRefresh?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        text: getApiErrorMessage(err, "Failed to publish workflow"),
        type: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Open Mermaid Dialog
  const handleOpenMermaid = async () => {
    try {
      const res = await getProjectWorkflowMermaid(projectId, workflow._id);
      setMermaidText(res.data?.data?.mermaid || "");
    } catch {
      setMermaidText("graph TD\n  Error[\"Failed to fetch Mermaid diagram\"]");
    }
    setMermaidDialogOpen(true);
  };

  // Node telemetry update during test run
  const handleNodeExecutionUpdate = (
    nodeId: string,
    status: "running" | "completed" | "failed",
    previewText?: string
  ) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                executionStatus: status,
                liveTokenPreview: previewText
                  ? `${(n.data as any)?.liveTokenPreview || ""}${previewText}`
                  : (n.data as any)?.liveTokenPreview,
              },
            }
          : n
      )
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full relative bg-background overflow-hidden">
      {/* Canvas Top Bar */}
      <header className="h-14 border-b border-border px-4 flex items-center justify-between bg-card/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">{workflow.name}</h2>
          {workflow.publishedVersion > 0 ? (
            <Badge variant="secondary" className="text-[10px] font-mono h-5">
              v{workflow.publishedVersion}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-mono h-5 text-muted-foreground">
              Draft
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] uppercase font-mono h-5 ${
              workflow.visibility === "public"
                ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                : workflow.visibility === "unlisted"
                ? "border-purple-500/30 text-purple-500 bg-purple-500/5"
                : "border-border text-muted-foreground"
            }`}
          >
            {workflow.visibility || "private"}
          </Badge>
          {workflow.externalOwnerId && (
            <Badge variant="outline" className="text-[10px] font-mono h-5 text-blue-500 border-blue-500/30 bg-blue-500/5">
              User: {workflow.externalOwnerId}
            </Badge>
          )}
          {isDirty && (
            <span className="text-[11px] text-amber-500 font-medium animate-pulse">
              ● Unsaved changes
            </span>
          )}
          {message && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            render={<Link href={`/projects/${projectId}/workflows/${workflow._id}/runs`} />}
          >
            <ClockCounterClockwiseIcon className="size-3.5" />
            <span>Runs History</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenMermaid}
            className="h-8 gap-1.5 text-xs"
          >
            <CodeIcon className="size-3.5" />
            <span>Export Mermaid</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="h-8 gap-1.5 text-xs"
          >
            <FloppyDiskIcon className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save Draft"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={isPublishing}
            onClick={handlePublish}
            className="h-8 gap-1.5 text-xs hover:border-primary/40 hover:bg-primary/5"
          >
            <UploadSimpleIcon className="size-3.5 text-primary" />
            <span>{isPublishing ? "Publishing..." : "Publish Version"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setTestDrawerOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <PlayIcon className="size-3.5" weight="fill" />
            <span>Test Run</span>
          </Button>
        </div>
      </header>

      {/* Main Flow Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          deleteKeyCode={["Backspace", "Delete"]}
          onBeforeDelete={onBeforeDelete}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-muted/10"
        >
          <Background gap={16} size={1} />
          <Controls className="!bg-card !border-border !shadow-sm fill-foreground" />
          <MiniMap
            className="!bg-card !border-border !rounded-lg"
            nodeColor="#3b82f6"
            maskColor="rgba(0, 0, 0, 0.1)"
          />

          {/* Node Addition Palette Panel */}
          <Panel position="top-left" className="m-4">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" className="h-8 gap-1.5 rounded-xl px-3 text-xs shadow-sm">
                    <PlusIcon className="size-3.5" weight="bold" />
                    <span>Add Step</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="min-w-52 rounded-xl p-1">
                {!nodes.some((n) => n.type === "trigger") && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px]">Entry point</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="gap-2 rounded-lg"
                        onClick={() => handleAddNode("trigger", "Manual Trigger")}
                      >
                        <LightningIcon className="size-4 text-amber-500" weight="fill" />
                        <span>Trigger</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px]">Steps</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={() => handleAddNode("agentStep", "New Agent Step")}
                  >
                    <RobotIcon className="size-4 text-primary" weight="fill" />
                    <span>Agent Step</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={() => handleAddNode("toolStep", "New Tool Step")}
                  >
                    <WrenchIcon className="size-4 text-violet-500" weight="fill" />
                    <span>Tool Step</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={() => handleAddNode("knowledgeStep", "New Knowledge Step")}
                  >
                    <BookOpenIcon className="size-4 text-cyan-500" weight="fill" />
                    <span>Knowledge Step</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px]">Flow control</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={() => handleAddNode("condition", "Condition Branch")}
                  >
                    <GitBranchIcon className="size-4 text-orange-500" weight="fill" />
                    <span>Condition</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={() => handleAddNode("output", "Output Result")}
                  >
                    <CheckCircleIcon className="size-4 text-emerald-500" weight="fill" />
                    <span>Output</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Panel>

          {/* Shortcuts hint — select a node/edge first, these act on the selection */}
          <Panel position="bottom-left" className="m-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
              <span className="flex items-center gap-1.5">
                <Kbd>Del</Kbd>
                delete
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>{isMac ? "⌘" : "Ctrl"}+D</Kbd>
                duplicate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Esc</Kbd>
                close panel
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Config Drawer */}
      <NodeConfigDrawer
        projectId={projectId}
        node={selectedNode}
        nodes={nodes}
        edges={edges}
        open={configDrawerOpen}
        onOpenChange={setConfigDrawerOpen}
        onUpdateNode={handleUpdateNode}
      />

      {/* Test Run Drawer */}
      <TestRunDrawer
        projectId={projectId}
        workflowId={workflow._id}
        open={testDrawerOpen}
        onOpenChange={setTestDrawerOpen}
        onNodeExecutionUpdate={handleNodeExecutionUpdate}
      />

      {/* Mermaid Export Dialog */}
      <MermaidExportDialog
        open={mermaidDialogOpen}
        onOpenChange={setMermaidDialogOpen}
        mermaidText={mermaidText}
      />
    </div>
  );
}
