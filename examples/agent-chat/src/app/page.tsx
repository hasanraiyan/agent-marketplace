"use client";

import * as React from "react";
import {
  RobotIcon,
  SparkleIcon,
  ArrowsClockwiseIcon,
  MicrophoneIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  TreeStructureIcon,
  FileCodeIcon,
  LightningIcon,
  CheckCircleIcon,
  PaperPlaneRightIcon,
  DotsThreeCircleIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  SubagentSheet,
  WorkspaceFilePanel,
  VoiceIndicator,
  type ChatMessageData,
  type ChatToolCall,
  type ChatTodo,
  type ChatInterruptData,
  type ChatWorkspaceFile,
  type VoiceCallState,
} from "@/components/persona/chat";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// Interactive MCP Ext App widget HTML template that communicates via AppBridge
const SAMPLE_MCP_APP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      --bg: #fffbf0;
      --card: #ffffff;
      --border: #18181b;
      --text: #18181b;
      --muted: #71717a;
      --primary: #4f46e5;
      --shadow: 3px 3px 0px 0px #18181b;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #141519;
        --card: #1c1e24;
        --border: #383b45;
        --text: #f4f4f5;
        --muted: #a1a1aa;
        --primary: #6366f1;
        --shadow: 3px 3px 0px 0px #000000;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: var(--bg);
      color: var(--text);
      box-sizing: border-box;
    }
    .widget-container {
      border: 2px solid var(--border);
      background: var(--card);
      border-radius: 12px;
      padding: 14px;
      box-shadow: var(--shadow);
    }
    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 8px;
    }
    .widget-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 700;
      background: #dcfce7;
      color: #15803d;
      border: 1.5px solid var(--border);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .metric {
      background: var(--bg);
      border: 2px solid var(--border);
      padding: 8px 10px;
      border-radius: 8px;
    }
    .metric-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-value {
      font-size: 18px;
      font-weight: 800;
      font-family: monospace;
      margin-top: 2px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      background: var(--primary);
      color: #ffffff;
      border: 2px solid var(--border);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 2px 2px 0px 0px var(--border);
      transition: all 0.1s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button:hover {
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0px 0px var(--border);
    }
    button:active {
      transform: translate(1px, 1px);
      box-shadow: 0px 0px 0px 0px var(--border);
    }
    button.secondary {
      background: #fef08a;
      color: #18181b;
    }
  </style>
</head>
<body>
  <div class="widget-container">
    <div class="widget-header">
      <div class="widget-title">
        <span>📊</span> <span>MCP Ext App: Realtime Cluster Health</span>
      </div>
      <span class="status-pill">● 99.98% SLA</span>
    </div>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Nodes</div>
        <div class="metric-value">12 / 12</div>
      </div>
      <div class="metric">
        <div class="metric-label">Throughput</div>
        <div class="metric-value">4.8k RPS</div>
      </div>
      <div class="metric">
        <div class="metric-label">p99 Latency</div>
        <div class="metric-value">18.4ms</div>
      </div>
    </div>
    <div class="actions">
      <button id="scale-btn">⚡ Scale to 16 Nodes</button>
      <button id="anomalies-btn" class="secondary">🔍 Diagnose Anomalies</button>
    </div>
  </div>

  <script>
    function sendPrompt(promptText) {
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "ui/message",
        params: {
          role: "user",
          content: [{ type: "text", text: promptText }]
        }
      }, "*");
    }

    document.getElementById("scale-btn").addEventListener("click", function() {
      sendPrompt("Scale the cluster to 16 nodes and verify latency reduction.");
    });

    document.getElementById("anomalies-btn").addEventListener("click", function() {
      sendPrompt("Run a deep diagnostic trace on cluster nodes for anomalies.");
    });
  </script>
</body>
</html>`;

export default function AgentChatPage() {
  const [messages, setMessages] = React.useState<ChatMessageData[]>([]);
  const [todos, setTodos] = React.useState<ChatTodo[]>([]);
  const [activeInterrupt, setActiveInterrupt] = React.useState<ChatInterruptData | null>(null);
  const [selectedSubagentId, setSelectedSubagentId] = React.useState<string | null>(null);
  const [viewedFile, setViewedFile] = React.useState<ChatWorkspaceFile | null>(null);
  const [voiceState, setVoiceState] = React.useState<VoiceCallState>("idle");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [activeScenario, setActiveScenario] = React.useState<"all" | "mcp" | "hitl" | "subagent">("all");
  const [isDark, setIsDark] = React.useState(false);
  const [input, setInput] = React.useState("");

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const workspaceFiles: Record<string, ChatWorkspaceFile> = {
    "specs/cluster-scaling.yaml": {
      path: "specs/cluster-scaling.yaml",
      title: "cluster-scaling.yaml",
      description: "Kubernetes Horizontal Pod Autoscaler manifest",
      content: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: persona-inference-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inference-engine
  minReplicas: 8
  maxReplicas: 24
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`,
    },
    "reports/architecture-audit.md": {
      path: "reports/architecture-audit.md",
      title: "architecture-audit.md",
      description: "Deep research audit generated by subagent",
      content: `# Production Architecture Audit & Scaling Blueprint

## Executive Summary
This report analyzes high-concurrency throughput bottlenecks in the AG-UI streaming pipeline and recommends architecture optimizations.

### Key Observations
1. **P99 Latency Profile**: Average cluster latency sits at **18.4ms**, well within the SLA of **50ms**.
2. **Memory Retention**: Zero memory leaks detected across 24-hour soak tests.
3. **SSE Connection Concurrency**: HTTP/2 multiplexing handles 10,000+ persistent agent streams simultaneously.

\`\`\`json
{
  "audit": "PASSED",
  "recommendedAction": "Scale replica set from 12 to 16 nodes prior to traffic peak",
  "estimatedCostDelta": "+$18.40/mo"
}
\`\`\``,
    },
  };

  const subagentConversation: ChatMessageData[] = [
    {
      id: "sub-1",
      role: "user",
      content: "Analyze cluster telemetry logs for node 07 and report any memory fragmentation.",
    },
    {
      id: "sub-2",
      role: "assistant",
      content: "Inspecting node 07 heap statistics and kernel logs...",
      toolCalls: [
        {
          id: "sub-tool-1",
          name: "fetch_node_telemetry",
          args: JSON.stringify({ nodeId: "node-07", duration: "1h" }),
          result: JSON.stringify({ status: "ok", memoryUsage: "64.2%", fragmentation: "1.2%" }),
          status: "done",
        },
      ],
    },
    {
      id: "sub-3",
      role: "assistant",
      content: "Telemetry scan complete. Node 07 is completely healthy. Memory fragmentation is at 1.2%, which is well within acceptable limits (threshold: 15%).",
    },
  ];

  const simulateAiResponse = React.useCallback(
    (promptText: string) => {
      setIsStreaming(true);

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: promptText },
      ]);

      // Assistant empty streaming turn (ThinkingIndicator)
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            isStreaming: true,
            toolCalls: [],
          },
        ]);
      }, 300);

      // Scenario: "ALL" triggers EVERY single component in sequence!
      if (activeScenario === "all") {
        setTodos([
          { content: "Plan multi-step system audit & scaling", status: "completed" },
          { content: "Query cluster telemetry MCP server", status: "in_progress" },
          { content: "Render interactive cluster health widget", status: "pending" },
          { content: "Spawn Codebase Researcher subagent for node analysis", status: "pending" },
          { content: "Request Human-in-the-Loop deployment approval", status: "pending" },
        ]);

        // Step 1: Running tool
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    toolCalls: [
                      {
                        id: "tool-telemetry",
                        name: "query_cluster_telemetry",
                        args: JSON.stringify({ cluster: "prod-us-east-1", metrics: ["nodes", "rps", "p99"] }),
                        status: "running",
                      },
                    ],
                  }
                : msg
            )
          );
        }, 1200);

        // Step 2: Tool completes + MCP App Widget renders
        setTimeout(() => {
          setTodos((t) => [
            t[0],
            { ...t[1], status: "completed" },
            { ...t[2], status: "completed" },
            { ...t[3], status: "in_progress" },
            t[4],
          ]);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    toolCalls: [
                      {
                        id: "tool-telemetry",
                        name: "query_cluster_telemetry",
                        args: JSON.stringify({ cluster: "prod-us-east-1", metrics: ["nodes", "rps", "p99"] }),
                        result: JSON.stringify({ healthyNodes: 12, rps: 4820, p99Ms: 18.4 }),
                        status: "done",
                      },
                      {
                        id: "tool-widget",
                        name: "render_cluster_dashboard",
                        args: JSON.stringify({ widget: "cluster-health-v2" }),
                        result: JSON.stringify({ status: "rendered" }),
                        status: "done",
                        mcpApp: {
                          initialHtml: SAMPLE_MCP_APP_HTML,
                        },
                      },
                      {
                        id: "tool-subagent",
                        name: "task",
                        args: JSON.stringify({ role: "Codebase Researcher", objective: "Audit node 07" }),
                        result: JSON.stringify({ status: "success", node: "healthy" }),
                        status: "done",
                        subagentMessages: subagentConversation,
                      },
                      {
                        id: "tool-file",
                        name: "present_file",
                        args: JSON.stringify({ filePath: "reports/architecture-audit.md" }),
                        result: JSON.stringify({ status: "success", filePath: "reports/architecture-audit.md" }),
                        status: "done",
                      },
                    ],
                  }
                : msg
            )
          );
        }, 2400);

        // Step 3: HITL Interrupt Panel triggered
        setTimeout(() => {
          setTodos((t) => [
            t[0],
            t[1],
            t[2],
            { ...t[3], status: "completed" },
            { ...t[4], status: "in_progress" },
          ]);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: "I've analyzed cluster telemetry, mounted the **MCP Ext App**, and had the **Codebase Researcher** subagent inspect node 07.\n\nTo apply the recommended scaling manifest to **production**, please confirm your authorization below:",
                  }
                : msg
            )
          );

          setActiveInterrupt({
            kind: "hitl",
            actionRequests: [
              {
                id: "act-approve-scale",
                label: "Approve 16-Node Cluster Scaling",
                description: "Applies specs/cluster-scaling.yaml to inference-engine in namespace 'production'.",
              },
            ],
          });
        }, 3400);
      } else if (activeScenario === "mcp") {
        // Individual MCP scenario
        setTodos([
          { content: "Query cluster telemetry MCP server", status: "completed" },
          { content: "Render interactive cluster health widget", status: "completed" },
        ]);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    content: "Telemetry query completed. Interactive MCP Ext App widget rendered below. Click any button in the widget to trigger follow-up prompts:",
                    toolCalls: [
                      {
                        id: "tool-widget-only",
                        name: "render_cluster_dashboard",
                        args: JSON.stringify({ widget: "cluster-health-v2" }),
                        result: JSON.stringify({ status: "rendered" }),
                        status: "done",
                        mcpApp: { initialHtml: SAMPLE_MCP_APP_HTML },
                      },
                    ],
                  }
                : msg
            )
          );
          setIsStreaming(false);
        }, 1800);
      } else if (activeScenario === "hitl") {
        // Individual HITL scenario
        setTodos([
          { content: "Prepare deployment configuration", status: "completed" },
          { content: "Request Human-in-the-Loop authorization", status: "in_progress" },
        ]);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: "Security policy requires explicit confirmation before executing this infrastructure modification:",
                  }
                : msg
            )
          );

          setActiveInterrupt({
            kind: "hitl",
            actionRequests: [
              {
                id: "act-standalone-deploy",
                label: "Authorize Cluster Rollout",
                description: "Scales deployment to 16 replicas.",
              },
            ],
          });
        }, 1500);
      } else {
        // Subagents & Files scenario
        setTodos([
          { content: "Spawn Codebase Researcher subagent", status: "completed" },
          { content: "Generate architecture audit artifact", status: "completed" },
        ]);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    content: "The **Codebase Researcher** subagent has completed its analysis. You can click 'View Subagent' to inspect its private thoughts or click the file link to view the markdown blueprint:",
                    toolCalls: [
                      {
                        id: "tool-subagent-alone",
                        name: "task",
                        args: JSON.stringify({ role: "Codebase Researcher" }),
                        result: JSON.stringify({ status: "done" }),
                        status: "done",
                        subagentMessages: subagentConversation,
                      },
                      {
                        id: "tool-file-alone",
                        name: "present_file",
                        args: JSON.stringify({ filePath: "reports/architecture-audit.md" }),
                        result: JSON.stringify({ status: "success", filePath: "reports/architecture-audit.md" }),
                        status: "done",
                      },
                    ],
                  }
                : msg
            )
          );
          setIsStreaming(false);
        }, 1800);
      }
    },
    [activeScenario]
  );

  const handleDecideHitl = React.useCallback(
    (actionId: string, decision: "approve" | "reject") => {
      setActiveInterrupt(null);
      setTodos((t) => t.map((item) => ({ ...item, status: "completed" })));

      const approvalMsgId = `assistant-decision-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: approvalMsgId,
          role: "assistant",
          content:
            decision === "approve"
              ? `✅ **Action Approved**: The production deployment has been authorized and executed successfully!

\`\`\`yaml
# Deployment Status
deployment.apps/inference-engine scaled to 16 replicas
status: Successfully rollout completed
p99_latency_target: 15.0ms
\`\`\`

All 16 nodes are reporting healthy heartbeats.`
              : `❌ **Action Rejected**: Operation cancelled. No modifications were applied to cluster resources.`,
        },
      ]);
      setIsStreaming(false);
    },
    []
  );

  const handleSendMessage = React.useCallback(
    (text: string) => {
      simulateAiResponse(text);
    },
    [simulateAiResponse]
  );

  const handleReset = () => {
    setMessages([]);
    setTodos([]);
    setActiveInterrupt(null);
    setSelectedSubagentId(null);
    setViewedFile(null);
    setIsStreaming(false);
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-background text-foreground font-sans">
        {/* Soft Tactile Neobrutalism Header */}
        <header className="flex h-16 items-center justify-between border-b-2 border-border bg-card px-4 sm:px-6 shadow-[0px_2px_0px_0px_var(--border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground border-2 border-border shadow-[2px_2px_0px_0px_var(--border)]">
              <RobotIcon size={22} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">Persona Agent Studio</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border-2 border-border shadow-[1px_1px_0px_0px_var(--border)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium hidden sm:block">
                Soft Tactile Neobrutalism • Testing all Persona Registry Components
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime Voice Orb */}
            <div className="flex items-center gap-2 rounded-xl border-2 border-border bg-secondary px-3 py-1.5 shadow-[2px_2px_0px_0px_var(--border)]">
              <VoiceIndicator state={voiceState} />
              <button
                type="button"
                onClick={() =>
                  setVoiceState((s) => (s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle"))
                }
                className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <MicrophoneIcon size={16} weight="bold" />
                <span className="capitalize hidden md:inline">{voiceState}</span>
              </button>
            </div>

            {/* Dark/Light Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="tactile-btn flex h-9 w-9 items-center justify-center bg-card text-foreground"
            >
              {isDark ? <SunIcon size={18} weight="bold" /> : <MoonIcon size={18} weight="bold" />}
            </button>

            {/* Reset conversation */}
            <button
              type="button"
              onClick={handleReset}
              title="Reset conversation"
              className="tactile-btn flex h-9 w-9 items-center justify-center bg-card text-foreground"
            >
              <ArrowsClockwiseIcon size={18} weight="bold" />
            </button>
          </div>
        </header>

        {/* Tactile Scenario Bar */}
        <div className="flex items-center justify-between border-b-2 border-border bg-muted/40 px-4 sm:px-6 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <span className="text-muted-foreground mr-1 hidden sm:inline uppercase tracking-wider text-[11px]">
              Preset Mode:
            </span>
            <button
              type="button"
              onClick={() => setActiveScenario("all")}
              className={`tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 ${
                activeScenario === "all" ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
              }`}
            >
              <LightningIcon size={16} weight="bold" />
              Trigger ALL Components
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario("mcp")}
              className={`tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 ${
                activeScenario === "mcp" ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
              }`}
            >
              <ChartBarIcon size={16} weight="bold" />
              MCP Ext App
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario("hitl")}
              className={`tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 ${
                activeScenario === "hitl" ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
              }`}
            >
              <ShieldCheckIcon size={16} weight="bold" />
              HITL Approval
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario("subagent")}
              className={`tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 ${
                activeScenario === "subagent" ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
              }`}
            >
              <TreeStructureIcon size={16} weight="bold" />
              Subagent & Files
            </button>
          </div>

          <div className="text-xs font-bold text-muted-foreground hidden lg:flex items-center gap-2">
            <span>Model: <code className="bg-secondary px-2 py-0.5 rounded border border-border text-[11px]">claude-3-7-sonnet</code></span>
            <span>•</span>
            <span>Registry: <code className="bg-secondary px-2 py-0.5 rounded border border-border text-[11px]">persona/chat</code></span>
          </div>
        </div>

        {/* Main Chat Viewport */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <ChatScroller className="flex-1">
            {messages.length === 0 ? (
              <div className="py-6 sm:py-8">
                <div className="tactile-card bg-card p-6 sm:p-8 text-center max-w-2xl mx-auto">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent border-2 border-border shadow-[2px_2px_0px_0px_var(--border)] mb-4">
                    <SparkleIcon size={28} weight="bold" />
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight mb-2">
                    Soft Tactile Neobrutalism Chatbot
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground mb-6 max-w-md mx-auto">
                    Click any test prompt below to simulate a live AI agent turn that exercises every single component in our registry.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <button
                      type="button"
                      onClick={() => simulateAiResponse("Execute full system audit with MCP app, subagent analysis, and deployment approval.")}
                      className="tactile-card bg-secondary/70 p-4 text-left hover:bg-secondary"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-primary">
                        <LightningIcon size={16} weight="bold" />
                        <span>Trigger ALL Components</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Fires Thinking, Todos, Tools, MCP Ext App, Subagent Drawer, and HITL Interrupt!
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenario("mcp");
                        simulateAiResponse("Query cluster metrics and mount the interactive MCP Ext App.");
                      }}
                      className="tactile-card bg-secondary/70 p-4 text-left hover:bg-secondary"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-primary">
                        <ChartBarIcon size={16} weight="bold" />
                        <span>Interactive MCP Ext App</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Renders a live sandboxed widget that dispatches prompts back to the chat on click.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenario("hitl");
                        simulateAiResponse("Prepare production deployment configuration with approval gateway.");
                      }}
                      className="tactile-card bg-secondary/70 p-4 text-left hover:bg-secondary"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-primary">
                        <ShieldCheckIcon size={16} weight="bold" />
                        <span>Human-in-the-Loop Gateway</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Pauses agent execution and waits for your Approve / Reject decision.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenario("subagent");
                        simulateAiResponse("Spawn a Codebase Researcher subagent to audit node 07.");
                      }}
                      className="tactile-card bg-secondary/70 p-4 text-left hover:bg-secondary"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-primary">
                        <TreeStructureIcon size={16} weight="bold" />
                        <span>Subagent & File Drawer</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Inspect nested subagent reasoning and view generated workspace markdown files.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatScrollerItem key={msg.id} className="w-full">
                    <ChatMessage
                      message={msg}
                      todos={todos}
                      onOpenSubagent={() => setSelectedSubagentId("subagent-1")}
                      onOpenWorkspaceFile={(path) => {
                        const f = workspaceFiles[path] || {
                          path,
                          title: path.split("/").pop() || path,
                          content: "# File Content\n\nPreviewing generated workspace artifact.",
                        };
                        setViewedFile(f);
                      }}
                      onSendMessage={handleSendMessage}
                    />
                  </ChatScrollerItem>
                ))}

                  {/* HITL Interrupt Panel styled for Neobrutalism */}
                  {activeInterrupt && (
                    <ChatScrollerItem>
                      <div className="tactile-card bg-accent/20 border-2 border-border p-4 my-2">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                          <ShieldCheckIcon size={18} weight="bold" />
                          Human Authorization Required
                        </div>
                        <InterruptPanel
                          interrupt={activeInterrupt}
                          onDecideHitl={handleDecideHitl}
                        />
                      </div>
                    </ChatScrollerItem>
                  )}
                </>
              )}
          </ChatScroller>

          {/* Floating Tactile Composer Dock */}
          <div className="border-t-2 border-border bg-card p-4 shadow-[0px_-2px_0px_0px_var(--border)]">
            <div className="mx-auto max-w-3xl">
              <ChatComposer
                value={input}
                onChange={setInput}
                placeholder={
                  activeScenario === "all"
                    ? "Type any prompt to run the complete multi-step agent simulation..."
                    : activeScenario === "mcp"
                    ? "Ask about cluster metrics or click widget actions..."
                    : activeScenario === "hitl"
                    ? "Type a deployment instruction..."
                    : "Ask the agent to delegate subtasks or inspect files..."
                }
                isStreaming={isStreaming}
                onSend={() => {
                  if (!input.trim()) return;
                  simulateAiResponse(input);
                  setInput("");
                }}
                onStop={() => setIsStreaming(false)}
              />
            </div>
          </div>
        </div>

        {/* Subagent Replay Drawer */}
        <SubagentSheet
          open={Boolean(selectedSubagentId)}
          onOpenChange={(open) => {
            if (!open) setSelectedSubagentId(null);
          }}
          messages={subagentConversation}
        />

        {/* Workspace File Preview Drawer */}
        <WorkspaceFilePanel
          file={viewedFile}
          onOpenChange={(open) => {
            if (!open) setViewedFile(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
