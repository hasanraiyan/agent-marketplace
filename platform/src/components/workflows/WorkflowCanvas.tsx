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
import { TriggerNode } from "./nodes/TriggerNode";
import { AgentStepNode } from "./nodes/AgentStepNode";
import { ToolStepNode } from "./nodes/ToolStepNode";
import { KnowledgeStepNode } from "./nodes/KnowledgeStepNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { OutputNode } from "./nodes/OutputNode";
import { NodeConfigDrawer } from "./NodeConfigDrawer";
import { TestRunDrawer } from "./TestRunDrawer";
import { MermaidExportDialog } from "./MermaidExportDialog";
import {
  saveProjectWorkflowDraft,
  publishProjectWorkflow,
  getProjectWorkflowMermaid,
} from "@/lib/api/projects";

const nodeTypes = {
  trigger: TriggerNode,
  agentStep: AgentStepNode,
  toolStep: ToolStepNode,
  knowledgeStep: KnowledgeStepNode,
  condition: ConditionNode,
  output: OutputNode,
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

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  };

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
        text: err?.response?.data?.message || err?.message || "Failed to save draft",
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
        text: err?.response?.data?.message || err?.message || "Failed to publish workflow",
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
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
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
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-border bg-card/90 backdrop-blur shadow-sm">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase px-2">
                Add Step
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleAddNode("agentStep", "New Agent Step")}
              >
                <RobotIcon className="size-3.5 text-primary" />
                <span>Agent</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleAddNode("toolStep", "New Tool Step")}
              >
                <WrenchIcon className="size-3.5 text-violet-500" />
                <span>Tool</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleAddNode("knowledgeStep", "New Knowledge Step")}
              >
                <BookOpenIcon className="size-3.5 text-cyan-500" />
                <span>Knowledge</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleAddNode("condition", "Condition Branch")}
              >
                <GitBranchIcon className="size-3.5 text-orange-500" />
                <span>Condition</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleAddNode("output", "Output Result")}
              >
                <CheckCircleIcon className="size-3.5 text-emerald-500" />
                <span>Output</span>
              </Button>
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
