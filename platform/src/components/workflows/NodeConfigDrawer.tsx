"use client";

import * as React from "react";
import { XIcon, SparkleIcon, WrenchIcon, ArrowsClockwiseIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getProjectAgents } from "@/lib/api/projects";

interface NodeConfigDrawerProps {
  projectId: string;
  node: any | null;
  nodes: any[];
  edges: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateNode: (nodeId: string, updatedData: any) => void;
}

export function NodeConfigDrawer({
  projectId,
  node,
  nodes,
  edges,
  open,
  onOpenChange,
  onUpdateNode,
}: NodeConfigDrawerProps) {
  const [agents, setAgents] = React.useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = React.useState(false);

  // Form local state
  const [label, setLabel] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [config, setConfig] = React.useState<Record<string, any>>({});
  const [retryPolicy, setRetryPolicy] = React.useState<any>({
    maxRetries: 0,
    backoffMs: 1000,
    exponential: true,
  });
  const [onError, setOnError] = React.useState<string>("fail");

  // Load project agents for agentStep selector
  React.useEffect(() => {
    if (open && projectId) {
      setLoadingAgents(true);
      getProjectAgents(projectId)
        .then((res) => {
          setAgents(res.data?.data || []);
        })
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [open, projectId]);

  // Sync state when node changes
  React.useEffect(() => {
    if (node) {
      setLabel(node.data?.label || "");
      setDescription(node.data?.description || "");
      setConfig(node.data?.config || {});
      setRetryPolicy(
        node.data?.retryPolicy || { maxRetries: 0, backoffMs: 1000, exponential: true }
      );
      setOnError(node.data?.onError || "fail");
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    onUpdateNode(node.id, {
      ...node.data,
      label,
      description,
      config,
      retryPolicy,
      onError,
    });
    onOpenChange(false);
  };

  // Find upstream nodes for dynamic variable suggestions
  const upstreamNodes = React.useMemo(() => {
    const directPredecessors = new Set(
      edges.filter((e) => e.target === node.id).map((e) => e.source)
    );
    return nodes.filter((n) => directPredecessors.has(n.id) || n.type === "trigger");
  }, [node.id, nodes, edges]);

  const insertVariable = (varPath: string, targetField: string) => {
    const currentVal = config[targetField] || "";
    setConfig({
      ...config,
      [targetField]: currentVal ? `${currentVal} {{${varPath}}}` : `{{${varPath}}}`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] font-mono uppercase">
              {node.type}
            </Badge>
          </div>
          <SheetTitle className="text-lg font-semibold">Configure {node.data?.label || node.id}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Edit parameters, upstream variable bindings, and node resilience policies.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* General info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Node Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Step title"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional explanation"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Upstream Variable Picker */}
          {upstreamNodes.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <SparkleIcon className="size-3 text-primary" />
                <span>Available Upstream Variables</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {upstreamNodes.map((un) => {
                  const varPath =
                    un.type === "trigger" ? "trigger.payload" : `steps.${un.id}.output.text`;
                  return (
                    <button
                      key={un.id}
                      type="button"
                      onClick={() =>
                        insertVariable(
                          varPath,
                          node.type === "output" ? "outputMapping" : "inputTemplate"
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background border border-border text-[10px] font-mono text-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
                      title={`Click to insert {{${varPath}}}`}
                    >
                      <span>+{un.data?.label || un.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Node-specific configurations */}
          {node.type === "agentStep" && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Select Agent</Label>
                <select
                  value={config.agentId || ""}
                  onChange={(e) => {
                    const selected = agents.find((a) => a._id === e.target.value);
                    setConfig({
                      ...config,
                      agentId: e.target.value,
                      modelName: selected?.modelName || "default",
                    });
                  }}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose an Agent --</option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.modelName || "default"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Input Prompt Template</Label>
                <Textarea
                  value={config.inputTemplate || ""}
                  onChange={(e) => setConfig({ ...config, inputTemplate: e.target.value })}
                  placeholder="e.g. {{trigger.payload.query}} or {{steps.step1.output.text}}"
                  rows={3}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Pin to Published Snapshot</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Freeze agent prompt and model configuration upon publishing.
                  </p>
                </div>
                <Switch
                  checked={config.pinSnapshot !== false}
                  onCheckedChange={(checked) => setConfig({ ...config, pinSnapshot: checked })}
                />
              </div>
            </div>
          )}

          {node.type === "toolStep" && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tool Name / Action</Label>
                <Input
                  value={config.toolName || ""}
                  onChange={(e) => setConfig({ ...config, toolName: e.target.value })}
                  placeholder="e.g. validate_email or fetch_order"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {node.type === "knowledgeStep" && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Knowledge Base ID</Label>
                <Input
                  value={config.knowledgeBaseId || ""}
                  onChange={(e) => setConfig({ ...config, knowledgeBaseId: e.target.value })}
                  placeholder="Knowledge Base ObjectId"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Query Template</Label>
                <Input
                  value={config.queryTemplate || ""}
                  onChange={(e) => setConfig({ ...config, queryTemplate: e.target.value })}
                  placeholder="e.g. {{trigger.payload.question}}"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Top K Documents</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.topK || 5}
                  onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value) || 5 })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {node.type === "output" && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Output Format</Label>
                <select
                  value={config.outputType || "text"}
                  onChange={(e) => setConfig({ ...config, outputType: e.target.value })}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="text">Plain Text / Resolved String</option>
                  <option value="json">Structured JSON (Parsed Object)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Output Value Mapping</Label>
                <Textarea
                  value={config.outputMapping || ""}
                  onChange={(e) => setConfig({ ...config, outputMapping: e.target.value })}
                  placeholder="e.g. {{steps.agent1.output.text}}"
                  rows={3}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          )}

          {node.type === "condition" && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Condition Expression</Label>
                <Input
                  value={config.expression || ""}
                  onChange={(e) => setConfig({ ...config, expression: e.target.value })}
                  placeholder="e.g. {{steps.agent1.output.isApproved}} or true"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Evaluates to boolean: routes to True branch if truthy / non-empty, False branch otherwise.
                </p>
              </div>
            </div>
          )}

          {/* Node Resilience & Error Policies (Gap 2) */}
          <div className="space-y-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ArrowsClockwiseIcon className="size-3.5 text-primary" />
              <span>Retry & Resilience Policy</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Max Retries (0-5)</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={retryPolicy.maxRetries || 0}
                  onChange={(e) =>
                    setRetryPolicy({
                      ...retryPolicy,
                      maxRetries: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Backoff (ms)</Label>
                <Input
                  type="number"
                  min={100}
                  step={500}
                  value={retryPolicy.backoffMs || 1000}
                  onChange={(e) =>
                    setRetryPolicy({
                      ...retryPolicy,
                      backoffMs: parseInt(e.target.value) || 1000,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <Label className="text-[11px] text-muted-foreground">On Failure Strategy</Label>
              <select
                value={onError}
                onChange={(e) => setOnError(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="fail">Fail Workflow (Halt immediately)</option>
                <option value="continue">Continue (Set output null and proceed)</option>
                <option value="routeError">Route to Error Edge</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-border/50">
          <Button size="sm" onClick={handleSave} className="flex-1">
            Apply Changes
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
