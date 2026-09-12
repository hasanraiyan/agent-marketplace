"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import { openSSEStream } from "../streaming.js";
import type {
  PersonaNodeRunState,
  PersonaStreamingEvent,
  UseWorkflowStreamOptions,
  UseWorkflowStreamResult,
} from "../types.js";

export function useWorkflowStream(
  workflowId?: string,
  options?: UseWorkflowStreamOptions,
): UseWorkflowStreamResult {
  const { baseUrl, getAuthToken, fetchWithAuth, logger } = usePersonaContext();

  const [status, setStatus] = useState<
    "idle" | "running" | "completed" | "failed" | "cancelled"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeRuns, setNodeRuns] = useState<Record<string, PersonaNodeRunState>>(
    {},
  );
  const [text, setText] = useState<string>("");
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<PersonaStreamingEvent[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  currentRunIdRef.current = runId;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const currentRun = currentRunIdRef.current;
    if (currentRun) {
      try {
        await fetchWithAuth(`/workflows/runs/${currentRun}/cancel`, {
          method: "POST",
        });
      } catch (err) {
        logger.warn("Failed to send cancel request to workflow run", {
          runId: currentRun,
          error: String(err),
        });
      }
    }
    setStatus("cancelled");
    setActiveNodeId(null);
  }, [fetchWithAuth, logger]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
    setRunId(null);
    setActiveNodeId(null);
    setNodeRuns({});
    setText("");
    setOutput(null);
    setError(null);
    setEvents([]);
  }, []);

  const processStream = useCallback(
    async (
      url: string,
      method: "GET" | "POST",
      body?: string,
      targetRunId?: string,
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus("running");
      setError(null);

      const token = getAuthToken ? await getAuthToken() : null;
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }

      let assignedRunId = targetRunId ?? null;
      let accumulatedText = "";
      let finalOutput: unknown = null;

      try {
        const stream = await openSSEStream({
          url,
          method,
          headers,
          body,
          signal: controller.signal,
        });

        if (!stream.ok) {
          throw new Error(
            stream.errorText || `Stream request failed with status ${stream.status}`,
          );
        }

        const runIdHeader = stream.getHeader("x-persona-run-id");
        if (runIdHeader) {
          assignedRunId = runIdHeader;
          setRunId(runIdHeader);
        }

        let buffer = "";
        while (true) {
          const { done, value } = await stream.reader.read();
          if (done) break;
          if (!value) continue;

          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue; // heartbeats or comments
            if (trimmed.startsWith("data:")) {
              const rawData = trimmed.slice(5).trim();
              if (!rawData || rawData === "[DONE]") continue;

              try {
                const event = JSON.parse(rawData) as PersonaStreamingEvent;
                setEvents((prev) => [...prev, event]);
                optionsRef.current?.onEvent?.(event);

                if ("runId" in event && typeof event.runId === "string" && !assignedRunId) {
                  assignedRunId = event.runId;
                  setRunId(event.runId);
                }

                if (event.type === "TEXT_MESSAGE_CHUNK") {
                  accumulatedText += event.delta;
                  setText((prev) => prev + event.delta);
                } else if (event.type === "CUSTOM") {
                  if (event.name === "workflow_node_started") {
                    const val = event.value as {
                      nodeId: string;
                      nodeType: string;
                      nodeLabel: string;
                      input?: unknown;
                    };
                    setActiveNodeId(val.nodeId);
                    setNodeRuns((prev) => ({
                      ...prev,
                      [val.nodeId]: {
                        nodeId: val.nodeId,
                        nodeType: val.nodeType,
                        nodeLabel: val.nodeLabel,
                        status: "running",
                        startedAt: new Date().toISOString(),
                        input: val.input,
                      },
                    }));
                    optionsRef.current?.onNodeStarted?.(val);
                  } else if (event.name === "workflow_node_completed") {
                    const val = event.value as {
                      nodeId: string;
                      output: unknown;
                    };
                    setNodeRuns((prev) => {
                      const existing = prev[val.nodeId];
                      return {
                        ...prev,
                        [val.nodeId]: {
                          nodeId: val.nodeId,
                          nodeType: existing?.nodeType ?? "unknown",
                          nodeLabel: existing?.nodeLabel ?? val.nodeId,
                          status: "completed",
                          startedAt: existing?.startedAt,
                          finishedAt: new Date().toISOString(),
                          input: existing?.input,
                          output: val.output,
                        },
                      };
                    });
                    setActiveNodeId((curr) => (curr === val.nodeId ? null : curr));
                    finalOutput = val.output;
                    setOutput(val.output);
                    optionsRef.current?.onNodeCompleted?.(val);
                  } else if (event.name === "workflow_node_failed") {
                    const val = event.value as {
                      nodeId: string;
                      error: string;
                    };
                    setNodeRuns((prev) => {
                      const existing = prev[val.nodeId];
                      return {
                        ...prev,
                        [val.nodeId]: {
                          nodeId: val.nodeId,
                          nodeType: existing?.nodeType ?? "unknown",
                          nodeLabel: existing?.nodeLabel ?? val.nodeId,
                          status: "failed",
                          startedAt: existing?.startedAt,
                          finishedAt: new Date().toISOString(),
                          input: existing?.input,
                          error: val.error,
                        },
                      };
                    });
                    setActiveNodeId((curr) => (curr === val.nodeId ? null : curr));
                    optionsRef.current?.onNodeFailed?.(val);
                  }
                } else if (event.type === "RUN_FINISHED") {
                  setStatus("completed");
                  setActiveNodeId(null);
                  optionsRef.current?.onFinish?.({
                    runId: assignedRunId || "",
                    output: finalOutput,
                    text: accumulatedText,
                  });
                } else if (event.type === "RUN_ERROR") {
                  const runErr = new Error(event.message || event.code || "Workflow run error");
                  setStatus("failed");
                  setError(runErr);
                  setActiveNodeId(null);
                  optionsRef.current?.onError?.(runErr);
                }
              } catch {
                // Ignore parse errors on partial frames
              }
            }
          }
        }

        setStatus((prev) => (prev === "running" ? "completed" : prev));
        return finalOutput;
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("cancelled");
          return null;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setStatus("failed");
        setError(errorObj);
        setActiveNodeId(null);
        optionsRef.current?.onError?.(errorObj);
        throw errorObj;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [getAuthToken],
  );

  const start = useCallback(
    async (
      input?: unknown,
      opts?: { dryRun?: boolean; workflowId?: string },
    ): Promise<unknown> => {
      const targetWfId = opts?.workflowId || workflowId;
      if (!targetWfId) {
        throw new Error("Workflow ID must be provided to start execution");
      }

      setNodeRuns({});
      setText("");
      setOutput(null);
      setEvents([]);
      setActiveNodeId(null);

      const cleanBase = baseUrl.replace(/\/+$/, "");
      const url = `${cleanBase}/workflows/${targetWfId}/stream`;
      const body = JSON.stringify({
        input: input ?? {},
        dryRun: opts?.dryRun ?? false,
      });

      return processStream(url, "POST", body);
    },
    [workflowId, baseUrl, processStream],
  );

  const resume = useCallback(
    async (targetRunId: string, sinceSeq?: number): Promise<void> => {
      if (!targetRunId) {
        throw new Error("Run ID is required to resume stream");
      }
      setRunId(targetRunId);
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const query = sinceSeq !== undefined ? `?since=${sinceSeq}` : "";
      const url = `${cleanBase}/workflows/runs/${targetRunId}/resume${query}`;

      await processStream(url, "GET", undefined, targetRunId);
    },
    [baseUrl, processStream],
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    runId,
    status,
    isRunning: status === "running",
    activeNodeId,
    nodeRuns,
    text,
    output,
    error,
    events,
    start,
    cancel,
    resume,
    reset,
  };
}
