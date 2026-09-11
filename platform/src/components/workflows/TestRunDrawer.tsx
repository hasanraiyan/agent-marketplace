"use client";

import * as React from "react";
import {
  PlayIcon,
  StopIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  LightningIcon,
  RobotIcon,
  WrenchIcon,
  BookOpenIcon,
  GitBranchIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { runProjectWorkflow, cancelProjectWorkflowRun } from "@/lib/api/projects";
import { getApiErrorMessage } from "@/lib/api/core";

interface TestRunDrawerProps {
  projectId: string;
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNodeExecutionUpdate: (nodeId: string, status: "running" | "completed" | "failed", previewText?: string) => void;
}

interface StepTrace {
  nodeId: string;
  nodeType?: string;
  label: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
  streamText?: string;
}

function StepIcon({ nodeType }: { nodeType?: string }) {
  const className = "size-3.5";
  switch (nodeType) {
    case "trigger":
      return <LightningIcon className={className} weight="fill" />;
    case "agentStep":
      return <RobotIcon className={className} weight="fill" />;
    case "toolStep":
      return <WrenchIcon className={className} weight="fill" />;
    case "knowledgeStep":
      return <BookOpenIcon className={className} weight="fill" />;
    case "condition":
      return <GitBranchIcon className={className} weight="fill" />;
    case "output":
      return <CheckCircleIcon className={className} weight="fill" />;
    default:
      return <CircleIcon className={className} />;
  }
}

function StatusIndicator({ status }: { status: StepTrace["status"] }) {
  if (status === "running") return <Spinner className="size-3.5 text-primary" />;
  if (status === "failed") return <XCircleIcon className="size-3.5 text-destructive" weight="fill" />;
  return <CheckCircleIcon className="size-3.5 text-emerald-500" weight="fill" />;
}

function formatStepOutput(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.text === "string" && obj.text) return obj.text;
    if (typeof obj.result !== "undefined") {
      return typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result, null, 2);
    }
  }
  return JSON.stringify(output, null, 2);
}

export function TestRunDrawer({
  projectId,
  workflowId,
  open,
  onOpenChange,
  onNodeExecutionUpdate,
}: TestRunDrawerProps) {
  const [inputJson, setInputJson] = React.useState('{\n  "query": "Can you summarize our sales performance?"\n}');
  const [isDryRun, setIsDryRun] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [runMeta, setRunMeta] = React.useState<string | null>(null);
  const [steps, setSteps] = React.useState<StepTrace[]>([]);
  const [openStepIds, setOpenStepIds] = React.useState<string[]>([]);
  const [finalOutput, setFinalOutput] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleStartRun = async () => {
    let parsedInput: any = {};
    try {
      if (inputJson.trim()) {
        parsedInput = JSON.parse(inputJson);
      }
    } catch {
      setError("Invalid JSON input payload");
      return;
    }

    setError(null);
    setFinalOutput(null);
    setRunMeta(null);
    setSteps([]);
    setOpenStepIds([]);
    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Trigger execution with stream
      const res = await runProjectWorkflow(projectId, workflowId, {
        input: parsedInput,
        dryRun: isDryRun,
        isDryRun: isDryRun,
      });

      const runId = res.data?.data?.runId;
      if (runId) {
        setActiveRunId(runId);
      }

      setRunMeta(
        `Run started (${isDryRun ? "Dry Run Mode" : "Production Mode"}). Thread ID: ${res.data?.data?.threadId || "auto"}`
      );

      // Connect to resume/stream endpoint to tail live SSE frames
      const streamUrl = `/api/v1/projects/${projectId}/workflows/runs/${runId || "latest"}/resume`;
      const response = await fetch(streamUrl, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.body) {
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const event = JSON.parse(trimmed.slice(5).trim());

            if (event.name === "workflow_node_started") {
              const nodeId = event.value.nodeId as string;
              onNodeExecutionUpdate(nodeId, "running");
              setSteps((prev) => {
                if (prev.some((s) => s.nodeId === nodeId)) return prev;
                return [
                  ...prev,
                  {
                    nodeId,
                    nodeType: event.value.nodeType,
                    label: event.value.nodeLabel || nodeId,
                    status: "running",
                    startedAt: new Date().toLocaleTimeString(),
                  },
                ];
              });
              setOpenStepIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
            } else if (event.name === "workflow_node_completed") {
              const nodeId = event.value.nodeId as string;
              onNodeExecutionUpdate(nodeId, "completed");
              setSteps((prev) =>
                prev.map((s) =>
                  s.nodeId === nodeId
                    ? { ...s, status: "completed", durationMs: event.value.durationMs, output: event.value.output }
                    : s
                )
              );
            } else if (event.name === "workflow_node_failed") {
              const nodeId = event.value.nodeId as string;
              onNodeExecutionUpdate(nodeId, "failed");
              setSteps((prev) =>
                prev.map((s) => (s.nodeId === nodeId ? { ...s, status: "failed", error: event.value.error } : s))
              );
            } else if (event.type === "TEXT_MESSAGE_CHUNK" && event.parentStepId) {
              onNodeExecutionUpdate(event.parentStepId, "running", event.delta);
              setSteps((prev) =>
                prev.map((s) =>
                  s.nodeId === event.parentStepId
                    ? { ...s, streamText: (s.streamText || "") + (event.delta || "") }
                    : s
                )
              );
            } else if (event.type === "RUN_FINISHED") {
              setFinalOutput(event.output);
              setIsRunning(false);
            } else if (event.type === "RUN_ERROR") {
              setError(event.message || "Run encountered error");
              setIsRunning(false);
            }
          } catch {
            // Non-JSON frame
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(getApiErrorMessage(err, "Execution error"));
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancelRun = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (activeRunId) {
      try {
        await cancelProjectWorkflowRun(projectId, activeRunId);
        setRunMeta("Execution aborted by user.");
      } catch {}
    }
    setIsRunning(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant={isDryRun ? "secondary" : "default"}
              className="text-[10px] font-mono gap-1 uppercase"
            >
              {isDryRun ? <ShieldCheckIcon className="size-3 text-emerald-500" /> : null}
              <span>{isDryRun ? "Dry Run Sandbox" : "Live Execution"}</span>
            </Badge>
          </div>
          <SheetTitle className="text-lg font-semibold">Test Workflow</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Execute this workflow against mock trigger input with real-time canvas telemetry.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Dry Run Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                <span>Dry-Run Mode</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Exempt from credits. Mocks external and destructive tool calls.
              </p>
            </div>
            <Switch checked={isDryRun} onCheckedChange={setIsDryRun} disabled={isRunning} />
          </div>

          {/* Trigger Payload Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Trigger Input Payload (JSON)</Label>
            <Textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              disabled={isRunning}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button size="sm" onClick={handleStartRun} className="gap-1.5 flex-1">
                <PlayIcon className="size-3.5" weight="fill" />
                <span>Start Test Run</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleCancelRun}
                className="gap-1.5 flex-1"
              >
                <StopIcon className="size-3.5" weight="fill" />
                <span>Cancel / Abort Run</span>
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
              {error}
            </div>
          )}

          {/* Step-by-step execution trace */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Execution Steps</Label>
              {runMeta && <span className="text-[10px] text-muted-foreground">{runMeta}</span>}
            </div>

            {steps.length === 0 ? (
              <div className="h-24 flex items-center justify-center rounded-md border border-dashed border-border bg-background/50">
                <span className="text-xs text-muted-foreground italic">
                  No steps yet. Click Start Test Run to execute.
                </span>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background/50 px-3">
                <Accordion
                  multiple
                  value={openStepIds}
                  onValueChange={(value) => setOpenStepIds(value as string[])}
                >
                  {steps.map((step) => (
                    <AccordionItem key={step.nodeId} value={step.nodeId}>
                      <AccordionTrigger>
                        <span className="flex flex-1 items-center gap-2 pr-2">
                          <span
                            className={
                              step.status === "failed"
                                ? "text-destructive"
                                : step.status === "running"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }
                          >
                            <StepIcon nodeType={step.nodeType} />
                          </span>
                          <span className="flex-1 truncate">{step.label}</span>
                          <StatusIndicator status={step.status} />
                          {typeof step.durationMs === "number" && (
                            <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] text-muted-foreground">
                              {step.durationMs}ms
                            </Badge>
                          )}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {step.status === "running" && !step.streamText && (
                          <p className="text-[11px] text-muted-foreground italic">Running…</p>
                        )}
                        {step.streamText && (
                          <p className="whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[11px] text-foreground">
                            {step.streamText}
                            {step.status === "running" && (
                              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-primary/70 align-middle" />
                            )}
                          </p>
                        )}
                        {step.status === "failed" && step.error && (
                          <p className="rounded bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
                            {step.error}
                          </p>
                        )}
                        {step.status === "completed" && !step.streamText && step.output != null && (
                          <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[11px] text-foreground overflow-x-auto">
                            {formatStepOutput(step.output)}
                          </pre>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>

          {/* Final Output */}
          {finalOutput != null && (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label className="text-xs font-medium flex items-center gap-1 text-emerald-500">
                <CheckCircleIcon className="size-3.5" weight="fill" />
                <span>Final Output Payload</span>
              </Label>
              <pre className="p-2.5 rounded-md bg-muted/40 text-[11px] font-mono overflow-x-auto max-h-40 border border-border">
                {typeof finalOutput === "object" ? JSON.stringify(finalOutput, null, 2) : String(finalOutput)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
