"use client";

import * as React from "react";
import { PlayIcon, StopIcon, ShieldCheckIcon, CheckCircleIcon, XCircleIcon, SparkleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { runProjectWorkflow, cancelProjectWorkflowRun } from "@/lib/api/projects";

interface TestRunDrawerProps {
  projectId: string;
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNodeExecutionUpdate: (nodeId: string, status: "running" | "completed" | "failed", previewText?: string) => void;
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
  const [logs, setLogs] = React.useState<Array<{ type: string; message: string; timestamp: string }>>([]);
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
    setLogs([]);
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

      setLogs((prev) => [
        ...prev,
        {
          type: "info",
          message: `Run started (${isDryRun ? "Dry Run Mode" : "Production Mode"}). Thread ID: ${res.data?.data?.threadId || "auto"}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

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
              onNodeExecutionUpdate(event.value.nodeId, "running");
              setLogs((prev) => [
                ...prev,
                {
                  type: "node_start",
                  message: `[Start] ${event.value.nodeLabel || event.value.nodeId}`,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            } else if (event.name === "workflow_node_completed") {
              onNodeExecutionUpdate(event.value.nodeId, "completed");
              setLogs((prev) => [
                ...prev,
                {
                  type: "node_complete",
                  message: `[Complete] Node finished (${event.value.durationMs || 0}ms)`,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            } else if (event.name === "workflow_node_failed") {
              onNodeExecutionUpdate(event.value.nodeId, "failed");
              setLogs((prev) => [
                ...prev,
                {
                  type: "error",
                  message: `[Failed] ${event.value.error}`,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            } else if (event.type === "TEXT_MESSAGE_CHUNK" && event.parentStepId) {
              onNodeExecutionUpdate(event.parentStepId, "running", event.delta);
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
        setError(err?.response?.data?.message || err?.message || "Execution error");
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
        setLogs((prev) => [
          ...prev,
          {
            type: "error",
            message: "Execution aborted by user.",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
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

          {/* Live Execution Logs */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs font-medium">Live Execution Trace</Label>
            <div className="h-48 rounded-md border border-border bg-background/50 p-2.5 font-mono text-[11px] overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <span className="text-muted-foreground italic">No logs yet. Click Start Test Run to execute.</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[9px] text-muted-foreground shrink-0">{log.timestamp}</span>
                    <span
                      className={
                        log.type === "error"
                          ? "text-destructive"
                          : log.type === "node_complete"
                          ? "text-emerald-500"
                          : "text-foreground"
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Final Output */}
          {finalOutput && (
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
