"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderKanban,
  Plus,
  Sparkles,
  ArrowRight,
  Code2,
  Terminal,
  Shield,
  Zap,
  Database,
  Plug,
  Bot,
  BookOpen,
  Layers,
  CheckCircle2,
  Cpu,
  FileText,
  Wrench,
  KeyRound,
  ExternalLink,
  Users,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopyButton } from "@/components/ui/copy-button";
import { createProject } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";

const CODE_EXAMPLES = {
  typescript: {
    lang: "typescript",
    install: "pnpm add @personaai/sdk",
    filename: "agent-service.ts",
    code: `import { PersonaClient } from "@personaai/sdk";

// Initialize with your Project API key (minted in Developer Studio)
const client = new PersonaClient({
  apiKey: process.env.PERSONA_PROJECT_KEY,
  // baseUrl: "https://api.persona.hasanraiyan.me" // default
});

// Stream real-time AG-UI conversational agent responses
export async function runSupportAgent(userId: string, prompt: string) {
  const stream = client.chat.stream("agent_xyz", {
    messages: [{ role: "user", content: prompt }],
    // Isolates memory and checkpoint state to this external user
    headers: { "x-external-user-id": userId },
  });

  for await (const event of stream) {
    if (event.type === "text-delta") {
      process.stdout.write(event.delta);
    } else if (event.type === "tool-call") {
      console.log(\`\\n[Tool: \${event.toolName}]\`, event.args);
    }
  }
}`,
  },
  python: {
    lang: "python",
    install: "pip install persona-agent-sdk",
    filename: "agent_runner.py",
    code: `import os
import asyncio
from personaai import PersonaClient

# Authenticate with your Project API key
client = PersonaClient(
    api_key=os.environ["PERSONA_PROJECT_KEY"]
)

async def chat_with_agent(user_id: str, message: str):
    # Stream events with sub-second AG-UI protocol
    stream = client.chat.stream(
        agent_id="agent_xyz",
        messages=[{"role": "user", "content": message}],
        external_user_id=user_id
    )

    async for event in stream:
        if event.type == "text-delta":
            print(event.delta, end="", flush=True)
        elif event.type == "tool-call":
            print(f"\\n[Executing: {event.tool_name}]")

if __name__ == "__main__":
    asyncio.run(chat_with_agent("usr_123", "Summarize Q3 metrics"))`,
  },
  react: {
    lang: "tsx",
    install: "pnpm add @personaai/ui @personaai/react",
    filename: "ChatWidget.tsx",
    code: `"use client";

import { PersonaProvider } from "@personaai/react";
import { PersonaChatView } from "@personaai/ui";
import "@personaai/ui/styles.css"; // Bundled Tailwind utilities & KaTeX

export function AppSupportChat({ userToken }: { userToken: string }) {
  return (
    <PersonaProvider
      baseUrl="/api/persona-proxy"
      defaultAgentId="agent_xyz"
    >
      <div className="h-[600px] w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden">
        <PersonaChatView
          agentId="agent_xyz"
          title="Customer Support Copilot"
        />
      </div>
    </PersonaProvider>
  );
}`,
  },
  curl: {
    lang: "bash",
    install: "# Standard HTTP Server-Sent Events endpoint",
    filename: "agui_stream.sh",
    code: `curl -N -X POST "https://api.persona.hasanraiyan.me/api/v1/developer/agui" \\
  -H "Authorization: Bearer prj_live_your_project_key_here" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-id: agent_xyz" \\
  -H "x-external-user-id: usr_external_42" \\
  -d '{
    "messages": [
      { "role": "user", "content": "Analyze recent system anomalies." }
    ]
  }'`,
  },
};

const BLUEPRINTS = [
  {
    id: "support",
    title: "Customer Support & Triage Copilot",
    badge: "Most Popular",
    icon: Bot,
    description:
      "Autonomous conversational support agent with CRM MCP tool calling, semantic sentiment tracking, and human escalation.",
    defaultName: "Customer Support Copilot",
    defaultDesc:
      "Production-ready support copilot with ticket resolution and customer CRM tool integration.",
    tags: ["AG-UI Streaming", "MCP Connectors", "User Memory"],
  },
  {
    id: "rag",
    title: "Enterprise RAG Knowledge Assistant",
    badge: "Qdrant Vector",
    icon: Database,
    description:
      "Deep semantic vector search across proprietary PDF manuals, internal docs, and company policies with accurate source citations.",
    defaultName: "Enterprise Knowledge Assistant",
    defaultDesc:
      "Vector-backed RAG agent searching technical documentation and internal guidelines.",
    tags: ["Hybrid Search", "File Ingestion", "Chunk Citations"],
  },
  {
    id: "multi-agent",
    title: "Deep Multi-Agent Workflow Engine",
    badge: "LangGraph",
    icon: Layers,
    description:
      "Orchestrate complex workflows with specialized sub-agents, deterministic checkpoints, and persistent file memory.",
    defaultName: "Deep Agent Orchestrator",
    defaultDesc:
      "Multi-agent system delegating tasks across research, code generation, and audit verification.",
    tags: ["Subagents", "Thread Checkpoints", "Async Graphs"],
  },
  {
    id: "devops",
    title: "DevOps & Internal Automation Bot",
    badge: "REST Tools",
    icon: Wrench,
    description:
      "Connect agents to GitHub, GitLab, terminal runners, and custom REST APIs for automated PR reviews and deployments.",
    defaultName: "DevOps Automation Agent",
    defaultDesc:
      "Automation bot connecting GitHub CI/CD webhooks with infrastructure runtimes.",
    tags: ["GitHub MCP", "Terminal Runner", "Audit Logs"],
  },
];

export function DeveloperOnboardingHub({ onProjectCreated }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState("typescript");

  const openCreateModal = (prefillName = "", prefillDesc = "") => {
    setProjectName(prefillName);
    setProjectDesc(prefillDesc);
    setModalOpen(true);
  };

  const handleQuickCreate = async (e) => {
    e?.preventDefault();
    if (!projectName.trim()) {
      toast.error("Please provide a project name.");
      return;
    }

    try {
      setCreating(true);
      const res = await createProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
      });

      const newProj = res.data?.data;
      toast.success("Project created successfully!");
      setModalOpen(false);
      if (onProjectCreated) {
        onProjectCreated(newProj);
      } else if (newProj?._id) {
        router.push(developerRoutes.project(newProj._id));
      } else {
        router.push(developerRoutes.projects);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-background to-slate-900/[0.04] p-6 shadow-sm sm:p-10 dark:border-primary/25 dark:from-primary/[0.12] dark:via-background dark:to-slate-950">
        <div className="pointer-events-none absolute -right-12 -top-12 size-96 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
        <div className="pointer-events-none absolute -bottom-10 right-1/3 size-64 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:text-blue-400"
              >
                <Sparkles className="size-3.5" />
                Persona Developer Platform
              </Badge>
              <Badge
                variant="secondary"
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              >
                Multi-Tenant Isolation
              </Badge>
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Ship autonomous AI agents inside your own applications
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Persona Developer Studio provides complete headless infrastructure for external apps.
              Create an isolated Project to manage dedicated API credentials, Bring-Your-Own-LLM
              providers, vector RAG knowledge, MCP connectors, and real-time AG-UI streaming.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => openCreateModal()}
                className="group h-11 rounded-full bg-[#1E60FF] px-6 font-bold text-white shadow-lg shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] hover:shadow-xl hover:shadow-[#1E60FF]/30 active:scale-95"
              >
                <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />
                Create Your First Project
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>

              <Link href={developerRoutes.projectNew}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-full px-5 font-semibold transition-all hover:bg-accent"
                >
                  Custom Configuration
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics / Architecture Badge Box */}
          <div className="grid w-full grid-cols-2 gap-3 sm:max-w-xs lg:w-auto">
            <div className="flex flex-col gap-1 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Isolation
                </span>
              </div>
              <p className="text-sm font-bold">100% Dedicated</p>
              <span className="text-[11px] text-muted-foreground">
                Zero cross-tenant leakage
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-500">
                <Zap className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Streaming
                </span>
              </div>
              <p className="text-sm font-bold">AG-UI Protocol</p>
              <span className="text-[11px] text-muted-foreground">
                Low-latency SSE events
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-500">
                <Cpu className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Models
                </span>
              </div>
              <p className="text-sm font-bold">Any LLM Provider</p>
              <span className="text-[11px] text-muted-foreground">
                BYOK (OpenAI, Claude, etc.)
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-500">
                <Code2 className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  SDKs
                </span>
              </div>
              <p className="text-sm font-bold">TS & Python</p>
              <span className="text-[11px] text-muted-foreground">
                Ready-to-use client SDKs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Step Guided Getting Started Roadmap */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            How to Get Started in 3 Steps
          </h2>
          <p className="text-sm text-muted-foreground">
            From zero to streaming production AI agents in your codebase.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Step 1 */}
          <div className="relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                  01
                </span>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/30 bg-primary/5 text-[11px] font-semibold text-primary"
                >
                  Step 1
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold tracking-tight">Create a Project Workspace</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Each Project functions as a secure boundary with its own client credentials, team
                  members, audit logs, and resource limits.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreateModal()}
                className="h-8 w-full justify-between rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary/10"
              >
                <span>Launch Project</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  02
                </span>
                <Badge variant="secondary" className="rounded-full text-[11px] font-medium">
                  Step 2
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold tracking-tight">Configure Providers & Tools</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Add your AI provider keys (OpenAI, Anthropic, Gemini, DeepSeek), attach Qdrant RAG
                  documents, and register MCP servers or REST endpoints.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-1.5 pt-3 border-t">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                BYOK Keys
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Vector RAG
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                MCP Tools
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  03
                </span>
                <Badge variant="secondary" className="rounded-full text-[11px] font-medium">
                  Step 3
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold tracking-tight">Integrate into Your App</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Install <code className="font-mono text-primary">@personaai/sdk</code> or our Python
                  SDK, mint an API key, and converse with agents via low-latency streaming.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-1.5 pt-3 border-t">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Node / TS
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Python
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                React UI
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Code Playground / Integration Preview */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              Developer Integration Preview
            </h2>
            <p className="text-sm text-muted-foreground">
              Drop Persona agents into your existing backend, serverless function, or frontend.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Need full API reference?</span>
            <Link
              href="https://persona.hasanraiyan.me/guides/sdk-quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Docs <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden border shadow-sm">
          <Tabs value={activeCodeTab} onValueChange={setActiveCodeTab} className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
              <TabsList variant="line" className="h-8 gap-2">
                <TabsTrigger value="typescript" className="text-xs font-semibold">
                  TypeScript / Node.js
                </TabsTrigger>
                <TabsTrigger value="python" className="text-xs font-semibold">
                  Python
                </TabsTrigger>
                <TabsTrigger value="react" className="text-xs font-semibold">
                  React / Next.js UI
                </TabsTrigger>
                <TabsTrigger value="curl" className="text-xs font-semibold">
                  REST cURL
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-xs text-muted-foreground md:inline">
                  {CODE_EXAMPLES[activeCodeTab]?.install}
                </span>
                <CopyButton
                  value={CODE_EXAMPLES[activeCodeTab]?.install}
                  label="Install command"
                  variant="icon"
                />
              </div>
            </div>

            {Object.entries(CODE_EXAMPLES).map(([tabKey, config]) => (
              <TabsContent key={tabKey} value={tabKey} className="m-0 p-0">
                <div className="flex items-center justify-between border-b bg-slate-950 px-4 py-2 text-slate-400 dark:bg-black">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <FileText className="size-3.5 text-slate-500" />
                    <span>{config.filename}</span>
                  </div>
                  <CopyButton value={config.code} label="Code snippet" variant="icon" />
                </div>
                <div className="overflow-x-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:bg-black">
                  <pre>{config.code}</pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>

      {/* Starter Blueprints */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Popular Agent Blueprints
          </h2>
          <p className="text-sm text-muted-foreground">
            Start from a verified architectural pattern or configure from scratch.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BLUEPRINTS.map((bp) => {
            const Icon = bp.icon;
            return (
              <div
                key={bp.id}
                className="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                      {bp.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-foreground">
                      {bp.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {bp.description}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {bp.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCreateModal(bp.defaultName, bp.defaultDesc)}
                    className="w-full rounded-xl text-xs font-bold transition-all group-hover:bg-[#1E60FF] group-hover:text-white group-hover:border-[#1E60FF]"
                  >
                    Launch Blueprint
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Architecture & Trust Features */}
      <Card className="border bg-muted/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">
            Built for Multi-Tenant Enterprise Applications
          </CardTitle>
          <CardDescription className="text-xs">
            Why development teams choose Persona Developer Platform for production agent systems.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Shield className="size-4 text-primary" />
                Hard Project Isolation
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete multi-tenant isolation. External users, sessions, memories, and tools never
                cross project boundaries or leak into public discovery.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Zap className="size-4 text-amber-500" />
                Real-Time Streaming
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Native AG-UI protocol delivers text deltas, thoughts, tool traces, and human-in-the-loop
                interrupts via standard Server-Sent Events.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <KeyRound className="size-4 text-emerald-500" />
                AES-256 BYOK Security
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your API keys are encrypted at rest with AES-256-GCM. We never mark up token costs
                or proxy your requests through third-party intermediaries.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Bot className="size-4 text-blue-500" />
                Deep Agent Graph Runtime
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Powered by LangGraph and Deep Agents. Run subagent delegations, tool calls, and state
                checkpoints with automatic recovery.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fast Quick-Create Project Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleQuickCreate}>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                Create Your Project
              </DialogTitle>
              <DialogDescription className="text-xs">
                A Project isolates your application&apos;s agents, providers, knowledge bases, and API
                credentials.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-name" className="text-xs font-bold text-foreground">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="quick-name"
                  placeholder="e.g. Acme Support Copilot"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                  required
                  maxLength={100}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-desc" className="text-xs font-bold text-foreground">
                  Description <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="quick-desc"
                  placeholder="What is this project's role in your app?"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  rows={3}
                  className="resize-none"
                  maxLength={500}
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
              <Link
                href={developerRoutes.projectNew}
                onClick={() => setModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Advanced settings
              </Link>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating || !projectName.trim()}
                  className="bg-[#1E60FF] font-bold text-white hover:bg-[#154ed0]"
                >
                  {creating && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  Launch Project
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
