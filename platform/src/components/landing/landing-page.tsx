"use client";

import * as React from "react";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  ChecksIcon,
  CopyIcon,
  CpuIcon,
  FolderIcon,
  ListIcon,
  MicrophoneIcon,
  PlugsConnectedIcon,
  WrenchIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AppIcon } from "@/components/layout/app-icon";
import { Button } from "@/components/ui/button";

type IconComponent = React.ComponentType<{ className?: string }>;

const DEV_DOCS_URL = "https://dev-docs.persona.hasanraiyan.me";

/* ── Display typeface, scoped to this page only ───────────────────────── */
const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

/* ── Local design tokens (scoped to this component tree via CSS vars) ───
   A separate palette from the app shell's shadcn theme, on purpose: this
   route is the only place on the site telling a first-time visitor what
   Persona is, so it gets its own identity — a technical "drawing sheet"
   rather than the product's own UI chrome. Nothing here touches globals.css. */
const LP_VARS = {
  "--lp-blueprint": "#14293D",
  "--lp-blueprint-2": "#1C3752",
  "--lp-blueprint-3": "#0E1C29",
  "--lp-vellum": "#EFECDF",
  "--lp-vellum-2": "#E6E1CE",
  "--lp-ink": "#1C1A15",
  "--lp-chalk": "#F4F1E6",
  "--lp-brass": "#CB8A34",
  "--lp-brass-dim": "#A96F26",
  "--lp-slate": "#6E7B85",
  "--lp-line": "rgba(28,26,21,0.16)",
  "--lp-line-dark": "rgba(244,241,230,0.2)",
} as React.CSSProperties;

/* ── Shiki Syntax Highlighting Loader ─────────────────────────────────── */
let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    const { createHighlighter } = await import("shiki");
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript", "tsx", "python"],
    });
  }
  return highlighterPromise;
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        try {
          const out = highlighter.codeToHtml(code, {
            lang,
            theme: "github-dark",
          });
          setHtml(out);
        } catch {
          setHtml("");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <div className="relative max-w-full overflow-x-auto bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-[#c9d1d9] sm:p-5">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="relative max-w-full overflow-x-auto text-xs leading-relaxed [&_pre]:!bg-[#0d1117] [&_pre]:!p-4 sm:[&_pre]:!p-5 [&_pre]:font-mono [&_pre]:!m-0 [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Corner ticks — a drafting-frame border used across the page ────────
   The recurring structural device: every panel is framed like a detail
   cropped from a larger drawing, not a rounded SaaS card. */
function CornerTicks({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "border-[var(--lp-line-dark)]" : "border-[var(--lp-line)]";
  return (
    <>
      <span aria-hidden className={`pointer-events-none absolute top-1.5 left-1.5 size-2.5 border-t border-l ${color}`} />
      <span aria-hidden className={`pointer-events-none absolute top-1.5 right-1.5 size-2.5 border-t border-r ${color}`} />
      <span aria-hidden className={`pointer-events-none absolute bottom-1.5 left-1.5 size-2.5 border-b border-l ${color}`} />
      <span aria-hidden className={`pointer-events-none absolute bottom-1.5 right-1.5 size-2.5 border-b border-r ${color}`} />
    </>
  );
}

/* ── Hero Quick Install Commands ───────────────────────────────────────── */
const QUICK_INSTALLS = [
  { id: "sdk", label: "TypeScript", cmd: "npm i @personaai/sdk" },
  {
    id: "shadcn",
    label: "shadcn UI",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/chat.json",
  },
  { id: "python", label: "Python", cmd: "pip install persona-agent-sdk" },
];

/* ── Interactive Lifecycle (five real stages, in order) ────────────────── */
type LifecycleStageId = "describe" | "connect" | "test" | "ship" | "protect";

interface LifecycleStage {
  id: LifecycleStageId;
  step: string;
  pill: string;
  title: string;
  lead: string;
  bullets: { keyword: string; text: string }[];
  chips: { label: string; href: string }[];
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    id: "describe",
    step: "01",
    pill: "Describe",
    title: "Describe agents in plain English, or wire them in code",
    lead: "Talk to the Agent Architect the way you'd brief a new hire, or declare the graph yourself. Either path compiles into the same running agent.",
    bullets: [
      { keyword: "Architect", text: "agents through chat — the control plane compiles a working graph while you talk." },
      { keyword: "Remember", text: "context between sessions with memory files scoped to the user or to the agent." },
      { keyword: "Configure", text: "tools, prompts, and multi-turn checkpoints directly, if you'd rather write it yourself." },
    ],
    chips: [
      { label: "Agent Architect guide", href: `${DEV_DOCS_URL}/guides/sdk/resources/agents` },
      { label: "Memory filesystem", href: `${DEV_DOCS_URL}/guides/sdk/resources/memory` },
    ],
  },
  {
    id: "connect",
    step: "02",
    pill: "Connect",
    title: "Connect real tools, documents, and APIs",
    lead: "An agent is only as useful as what it can reach. Wire it to live systems, your own documents, and typed endpoints.",
    bullets: [
      { keyword: "Plug in", text: "any Model Context Protocol server over stdio or SSE — tools are discovered automatically." },
      { keyword: "Search", text: "your own documents with project-scoped vector search over Qdrant." },
      { keyword: "Call", text: "your REST APIs directly; describe the shape once with Zod and Persona handles the rest." },
    ],
    chips: [
      { label: "MCP connectors", href: `${DEV_DOCS_URL}/guides/sdk/resources/mcps` },
      { label: "Vector RAG guide", href: `${DEV_DOCS_URL}/guides/sdk/resources/knowledge` },
      { label: "REST tools manifest", href: `${DEV_DOCS_URL}/guides/rest-tools` },
    ],
  },
  {
    id: "test",
    step: "03",
    pill: "Test",
    title: "Watch it run before anyone else sees it",
    lead: "Every token, tool call, and pause streams into a live playground, so you catch mistakes before a real user does.",
    bullets: [
      { keyword: "Inspect", text: "each tool call and reasoning step as it streams over the AG-UI protocol." },
      { keyword: "Approve", text: "sensitive actions by hand — Persona pauses and waits for a person before it acts." },
      { keyword: "Talk", text: "to the agent by voice, with the same trace available in real time." },
    ],
    chips: [
      { label: "Playground & devtools", href: `${DEV_DOCS_URL}/guides/devtools/quickstart` },
      { label: "AG-UI protocol docs", href: `${DEV_DOCS_URL}/guides/runtime/routes` },
    ],
  },
  {
    id: "ship",
    step: "04",
    pill: "Ship",
    title: "Call it from the product you're already building",
    lead: "Mount a server route in a few lines, or drop a finished chat component straight into your frontend.",
    bullets: [
      { keyword: "Mount", text: "the full runtime in Next.js, Express, or NestJS with one adapter call." },
      { keyword: "Install", text: "the official chat component into your own repo with zero CSS conflicts." },
      { keyword: "Run", text: "the same agent from Node.js, Python, or the edge — typed end to end either way." },
    ],
    chips: [
      { label: "Integration guide", href: `${DEV_DOCS_URL}/guides/integration-guide` },
      { label: "shadcn UI registry", href: `${DEV_DOCS_URL}/guides/ui/shadcn-registry` },
      { label: "Next.js adapter", href: `${DEV_DOCS_URL}/guides/nextjs/quickstart` },
    ],
  },
  {
    id: "protect",
    step: "05",
    pill: "Protect",
    title: "Keep every tenant, key, and action accountable",
    lead: "None of this matters if it isn't safe to run in production. Every project is isolated, every secret encrypted, every action logged.",
    bullets: [
      { keyword: "Isolate", text: "each customer inside its own project, with separate admins, credentials, and rate limits." },
      { keyword: "Encrypt", text: "every API key and OAuth token at rest with AES-256-GCM; secrets never reach the browser." },
      { keyword: "Log", text: "every prompt change, credential, and mutation to an audit trail that can't be edited after the fact." },
    ],
    chips: [
      { label: "Security & credentials", href: `${DEV_DOCS_URL}/guides/sdk/configuration` },
      { label: "Audit logs API", href: `${DEV_DOCS_URL}/guides/sdk/resources/audit-logs` },
    ],
  },
];

/* ── System Architecture Layers ───────────────────────────────────────── */
const ARCH_LAYERS = [
  {
    id: "app",
    level: "Layer 4",
    name: "Application & client presentation",
    tag: "What people see",
    summary:
      "Your frontend product, web copilot, or internal dashboard. Consumes agents through native React hooks, shadcn chat components, or raw HTTP/SSE streams.",
    items: ["@personaai/react", "@personaai/ui", "shadcn registry (/r/chat.json)", "Next.js App Router", "Mobile & REST clients"],
    docUrl: `${DEV_DOCS_URL}/guides/ui/components`,
  },
  {
    id: "runtime",
    level: "Layer 3",
    name: "Runtime & AG-UI orchestration",
    tag: "Runs every turn",
    summary:
      "Streaming state engine backed by LangGraph and the AG-UI protocol. Handles token-level SSE streams, checkpointed threads, memory files, and human interrupts.",
    items: ["AG-UI event streaming (SSE)", "Thread state checkpointing", "Human-in-the-loop interrupts", "Persistent memory files", "Subagent dispatch"],
    docUrl: `${DEV_DOCS_URL}/guides/runtime/quickstart`,
  },
  {
    id: "context",
    level: "Layer 2",
    name: "Context, tools & knowledge grounding",
    tag: "Where the facts come from",
    summary:
      "Grounds agents in your reality. Connects external systems over MCP, searches private knowledge bases, and executes schema-validated REST APIs.",
    items: ["Model Context Protocol (MCP)", "Qdrant vector knowledge (RAG)", "Zod-powered REST tools", "MCP ext-apps (sandboxed iframe)", "Project skill filesystems"],
    docUrl: `${DEV_DOCS_URL}/guides/sdk/resources/mcps`,
  },
  {
    id: "models",
    level: "Layer 1",
    name: "Foundation models & BYOK gateway",
    tag: "Chooses the model",
    summary:
      "Model-agnostic routing with AES-256-GCM encrypted API keys. Choose the right reasoning model per agent without getting locked into one vendor.",
    items: ["Anthropic Claude 3.7 / 3.5 Sonnet", "OpenAI GPT-4o / o3-mini", "Google Gemini 2.5 Pro / Flash", "DeepSeek R1 / V3", "Local models via Ollama"],
    docUrl: `${DEV_DOCS_URL}/guides/sdk/resources/providers`,
  },
];

/* ── Code Snippets with Syntax Highlight Languages ────────────────────── */
const CODE_SNIPPETS = [
  {
    id: "ts-sdk",
    title: "TypeScript SDK",
    lang: "typescript",
    filename: "agent-chat.ts",
    docUrl: `${DEV_DOCS_URL}/guides/sdk-quickstart`,
    code: `import { PersonaClient } from "@personaai/sdk";

const persona = new PersonaClient({
  baseUrl: "https://api.persona.hasanraiyan.me",
  credential: process.env.PERSONA_CREDENTIAL!, // "<keyId>.<secret>"
  externalUserId: "usr_49201",                 // Scoped to your logged-in user
});

// Stream real-time agent execution with AG-UI protocol
const stream = persona.chat.stream("agent_refund_expert", {
  messages: [{ role: "user", content: "Can you inspect return #8102 for me?" }],
});

for await (const event of stream) {
  if (event.type === "TEXT_MESSAGE_CHUNK" && event.delta) {
    process.stdout.write(event.delta);
  }
}`,
  },
  {
    id: "shadcn",
    title: "shadcn Registry",
    lang: "tsx",
    filename: "components/chat/agent-view.tsx",
    docUrl: `${DEV_DOCS_URL}/guides/ui/shadcn-registry`,
    code: `// 1. Install directly into your Next.js repo with zero CSS clashes:
// npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/chat.json

import { AgentChat } from "@/components/chat";

export default function SupportWorkspace() {
  return (
    <div className="h-[600px] w-full border border-border bg-card">
      <AgentChat
        agentId="agent_refund_expert"
        apiUrl="/api/persona/agui"
        features={{
          reasoningBlock: true,
          toolExecutionCards: true,
          mcpExtApps: true,
        }}
      />
    </div>
  );
}`,
  },
  {
    id: "nextjs",
    title: "Next.js Adapter",
    lang: "typescript",
    filename: "app/api/persona/[...persona]/route.ts",
    docUrl: `${DEV_DOCS_URL}/guides/nextjs/quickstart`,
    code: `import { createNextServerAdapter } from "@personaai/adapters/nextjs/server";
import { auth } from "@/lib/auth"; // Your existing authentication

const adapter = createNextServerAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  // Automatically scopes threads and memory to whoever is logged in:
  resolveUserFrom: async (req) => (await auth(req))?.userId ?? null,
});

// Exposes streaming chat, threads, files, memory, and MCP OAuth
export const { GET, POST } = adapter.handlers;`,
  },
  {
    id: "python",
    title: "Python SDK",
    lang: "python",
    filename: "run_agent.py",
    docUrl: `${DEV_DOCS_URL}/guides/sdk-quickstart-python`,
    code: `import os
from persona_agent_sdk import PersonaClient

client = PersonaClient(
    base_url="https://api.persona.hasanraiyan.me",
    credential=os.environ["PERSONA_CREDENTIAL"],
    external_user_id="usr_49201"
)

# Run full agent turn with automatic tool execution & memory
result = client.chat.send_message(
    agent_id="agent_refund_expert",
    messages=[{"role": "user", "content": "Summarize return policy violations"}]
)

print(result.text)`,
  },
  {
    id: "rest-tool",
    title: "Code-First REST Tools",
    lang: "typescript",
    filename: "tools/refund-policy.ts",
    docUrl: `${DEV_DOCS_URL}/guides/rest-tools`,
    code: `import { defineRestTool } from "@personaai/sdk/rest-tools";
import { z } from "zod";

export const checkRefundTool = defineRestTool({
  name: "Check order refund status",
  method: "GET",
  args: z.object({
    orderId: z.string().describe("E-commerce order ID"),
  }),
  url: (t) => \`https://api.store.com/orders/\${t.arg("orderId")}/refund-status\`,
  headers: { "X-User-Id": (t) => t.externalUserId },
  responseMappings: { status: "@data.status", eligible: "@data.isEligible" },
});`,
  },
];

/* ── shadcn Registry Items ────────────────────────────────────────────── */
const REGISTRY_ITEMS = [
  {
    name: "chat",
    title: "Agent Chat Timeline",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/chat.json",
    description:
      "A full agent chat timeline with AG-UI streaming, tool execution cards, MCP ext-apps, reasoning blocks, and a subagent drawer.",
    icon: ChatCircleIcon,
  },
  {
    name: "mcp-app",
    title: "MCP Ext-App Runner",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/mcp-app.json",
    description:
      "A sandboxed iframe runner with an app bridge for interactive Model Context Protocol client apps and prompt dispatch.",
    icon: PlugsConnectedIcon,
  },
  {
    name: "file-explorer",
    title: "Workspace Code Explorer",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/file-explorer.json",
    description:
      "A project code explorer and editor with tabs, markdown preview, syntax highlighting, and save/discard actions.",
    icon: FolderIcon,
  },
  {
    name: "voice-indicator",
    title: "Voice Audio Visualizer",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/voice-indicator.json",
    description:
      "A real-time audio waveform visualizer and status indicator with active-speech rings and connection states.",
    icon: MicrophoneIcon,
  },
];

/**
 * Persona marketing landing page — explains what the product is for
 * (build an agent by describing it, connect it to real tools, test it
 * live, then call it from your own app) before it goes deep on SDKs.
 */
function LandingPage() {
  const { isLoaded, user } = useUser();
  const signedIn = !!user;

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeInstallTab, setActiveInstallTab] = React.useState("sdk");
  const [activeLifecycleStage, setActiveLifecycleStage] = React.useState<LifecycleStageId>("describe");
  const [selectedArchLayer, setSelectedArchLayer] = React.useState<string>("runtime");
  const [activeCodeTab, setActiveCodeTab] = React.useState("ts-sdk");
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [interruptStatus, setInterruptStatus] = React.useState<"pending" | "approved" | "rejected">("pending");

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const activeStage = LIFECYCLE_STAGES.find((s) => s.id === activeLifecycleStage) ?? LIFECYCLE_STAGES[0];
  const activeSnippet = CODE_SNIPPETS.find((s) => s.id === activeCodeTab) ?? CODE_SNIPPETS[0];
  const activeInstall = QUICK_INSTALLS.find((q) => q.id === activeInstallTab) ?? QUICK_INSTALLS[0];
  const activeLayer = ARCH_LAYERS.find((l) => l.id === selectedArchLayer) ?? ARCH_LAYERS[1];

  return (
    <div
      style={LP_VARS}
      className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[var(--lp-vellum)] text-[var(--lp-ink)] selection:bg-[var(--lp-brass)]/30"
    >
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--lp-line)] bg-[var(--lp-vellum)]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
              <AppIcon className="size-7" />
              <div className="flex flex-col leading-tight">
                <span className={`${displayFont.className} text-sm font-semibold tracking-tight`}>Persona</span>
                <span className="text-[11px] text-[var(--lp-slate)]">AI agents you can ship</span>
              </div>
            </Link>

            <nav className="hidden items-center gap-5 text-[13px] text-[var(--lp-ink)]/70 md:flex lg:gap-6">
              <a href="#how-it-works" className="transition-colors hover:text-[var(--lp-ink)]">
                How it works
              </a>
              <a href="#architecture" className="transition-colors hover:text-[var(--lp-ink)]">
                Under the hood
              </a>
              <a href="#sdks" className="transition-colors hover:text-[var(--lp-ink)]">
                SDKs
              </a>
              <a href="#components" className="transition-colors hover:text-[var(--lp-ink)]">
                Components
              </a>
              <a
                href={DEV_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--lp-brass-dim)] transition-colors hover:underline"
              >
                Docs
                <ArrowUpRightIcon className="size-3" />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <a
              href={DEV_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 text-[13px] font-medium text-[var(--lp-ink)]/70 transition-colors hover:text-[var(--lp-ink)] sm:inline-flex"
            >
              <BookOpenIcon className="size-3.5 text-[var(--lp-brass-dim)]" />
              Guides & API
            </a>

            {isLoaded &&
              (signedIn ? (
                <Button
                  size="sm"
                  className="bg-[var(--lp-ink)] text-[var(--lp-chalk)] hover:bg-[var(--lp-ink)]/85"
                  render={<Link href="/projects" />}
                >
                  Studio
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button variant="ghost" size="sm" className="text-[var(--lp-ink)] hover:bg-[var(--lp-ink)]/8" render={<Link href="/sign-in" />}>
                    Sign in
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[var(--lp-ink)] text-[var(--lp-chalk)] hover:bg-[var(--lp-ink)]/85"
                    render={<Link href="/sign-up" />}
                  >
                    Get started
                  </Button>
                </div>
              ))}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex size-9 items-center justify-center border border-[var(--lp-line)] bg-[var(--lp-vellum)] text-[var(--lp-ink)]/70 transition-colors hover:text-[var(--lp-ink)] md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XIcon className="size-5" /> : <ListIcon className="size-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-b border-[var(--lp-line)] bg-[var(--lp-vellum)] px-6 py-5 md:hidden">
            <nav className="flex flex-col gap-3 text-sm">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1 text-[var(--lp-ink)]/75">
                How it works
              </a>
              <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="py-1 text-[var(--lp-ink)]/75">
                Under the hood
              </a>
              <a href="#sdks" onClick={() => setMobileMenuOpen(false)} className="py-1 text-[var(--lp-ink)]/75">
                SDKs & adapters
              </a>
              <a href="#components" onClick={() => setMobileMenuOpen(false)} className="py-1 text-[var(--lp-ink)]/75">
                UI components
              </a>
              <div className="my-1 border-t border-[var(--lp-line)]" />
              <a
                href={DEV_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-between py-1 font-semibold text-[var(--lp-brass-dim)]"
              >
                <span>Developer documentation</span>
                <ArrowUpRightIcon className="size-4" />
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* ── Main Container ───────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* ── Hero Section ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-10 py-12 sm:py-16 lg:grid lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14 lg:py-20">
          <div className="flex flex-col items-start gap-6">
            <h1 className={`${displayFont.className} text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.1rem] lg:leading-[1.12]`}>
              Describe the agent you need.
              <br />
              Persona builds it, tests it, and hands you the code to ship it.
            </h1>

            <p className="max-w-lg text-[15px] leading-relaxed text-pretty text-[var(--lp-ink)]/75 sm:text-base">
              Chat with the Agent Architect or write a small config — either way you get a
              working agent wired to your tools and data. Test it live in the playground, then
              call it from your product with an SDK, a server adapter, or a ready-made chat
              component.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              {isLoaded &&
                (signedIn ? (
                  <Button
                    size="lg"
                    className="w-full bg-[var(--lp-ink)] text-[var(--lp-chalk)] hover:bg-[var(--lp-ink)]/85 sm:w-auto"
                    render={<Link href="/projects" />}
                  >
                    Open Studio
                    <ArrowRightIcon className="size-4" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full bg-[var(--lp-ink)] text-[var(--lp-chalk)] hover:bg-[var(--lp-ink)]/85 sm:w-auto"
                    render={<Link href="/sign-up" />}
                  >
                    Start building — it's free
                    <ArrowRightIcon className="size-4" />
                  </Button>
                ))}

              <Button
                size="lg"
                variant="outline"
                className="w-full bg-transparent border-[var(--lp-ink)]/25 text-[var(--lp-ink)] hover:bg-[var(--lp-ink)]/8 sm:w-auto"
                render={<a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" />}
              >
                <BookOpenIcon className="size-4 text-[var(--lp-brass-dim)]" />
                Read the docs
                <ArrowUpRightIcon className="size-3.5 text-[var(--lp-ink)]/50" />
              </Button>
            </div>

            <div className="w-full max-w-md border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/70 p-3">
              <div className="flex items-center gap-3 overflow-x-auto border-b border-[var(--lp-line)] pb-2 no-scrollbar">
                {QUICK_INSTALLS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveInstallTab(tab.id)}
                    className={`text-[12px] font-medium whitespace-nowrap transition-colors ${
                      activeInstallTab === tab.id ? "text-[var(--lp-brass-dim)] font-semibold" : "text-[var(--lp-ink)]/55 hover:text-[var(--lp-ink)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 font-mono text-xs">
                <span className="truncate text-[var(--lp-ink)]/75 select-all">
                  <span className="text-[var(--lp-brass-dim)] select-none">$ </span>
                  {activeInstall.cmd}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeInstall.cmd, `install-${activeInstall.id}`)}
                  className="flex shrink-0 items-center gap-1 border border-[var(--lp-line)] bg-[var(--lp-vellum)] px-2 py-1 text-[10px] text-[var(--lp-ink)]/60 transition-colors hover:text-[var(--lp-ink)]"
                >
                  {copiedKey === `install-${activeInstall.id}` ? (
                    <>
                      <ChecksIcon className="size-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--lp-ink)]/55">
              Free to start. Swap models anytime — nothing here locks you to one provider.
            </p>
          </div>

          {/* Hero schematic: brief → agent → your product */}
          <AgentSchematic />
        </section>

        {/* ── Compatibility strip ──────────────────────────────────────── */}
        <section className="border-y border-[var(--lp-line)] py-5 sm:py-6">
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-[13px] text-[var(--lp-ink)]/60">Works with any model, any cloud, any framework.</span>
            <div className="flex flex-wrap items-center gap-2">
              {[
                "OpenAI GPT-4o",
                "Claude 3.7 Sonnet",
                "Google Gemini 2.5",
                "DeepSeek R1",
                "Model Context Protocol",
                "AG-UI streaming",
                "LangGraph",
              ].map((tech) => (
                <span key={tech} className="border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/60 px-2.5 py-1 text-[11px] font-medium text-[var(--lp-ink)]/75">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works (five real stages) ──────────────────────────── */}
        <section id="how-it-works" className="py-16 sm:py-20">
          <div className="flex flex-col items-start gap-2">
            <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-balance sm:text-3xl`}>
                  From a sentence to a running agent
                </h2>
                <p className="mt-1.5 max-w-xl text-[15px] text-[var(--lp-ink)]/70">
                  Five steps, from first draft to production traffic. Pick a stage to see what actually happens.
                </p>
              </div>
              <a
                href={`${DEV_DOCS_URL}/guides/integration-guide`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--lp-brass-dim)] hover:underline"
              >
                Read the full guide
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-8 flex w-full items-center gap-2 overflow-x-auto border-b border-[var(--lp-line)] pb-3 no-scrollbar">
            {LIFECYCLE_STAGES.map((s) => {
              const isActive = activeLifecycleStage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveLifecycleStage(s.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "border border-[var(--lp-brass)] bg-[var(--lp-brass)]/12 text-[var(--lp-brass-dim)]"
                      : "border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/50 text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]"
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-70">{s.step}</span>
                  <span>{s.pill}</span>
                </button>
              );
            })}
          </div>

          <div className="relative mt-8 grid gap-8 border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/40 p-6 lg:grid-cols-[1fr_1.05fr] lg:p-8">
            <CornerTicks tone="light" />
            <div className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-[var(--lp-brass-dim)]">
                  <span>Step {activeStage.step}</span>
                </div>
                <h3 className={`${displayFont.className} mt-2 text-xl font-semibold text-[var(--lp-ink)] sm:text-2xl`}>{activeStage.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--lp-ink)]/70">{activeStage.lead}</p>

                <ul className="mt-6 space-y-3 text-[13px] leading-relaxed text-[var(--lp-ink)]/75">
                  {activeStage.bullets.map((b) => (
                    <li key={b.keyword} className="flex items-start gap-2.5">
                      <CheckCircleIcon className="size-4 shrink-0 mt-0.5 text-[var(--lp-brass-dim)]" />
                      <span>
                        <strong className="font-semibold text-[var(--lp-ink)]">{b.keyword}</strong> {b.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--lp-line)] pt-6">
                {activeStage.chips.map((chip) => (
                  <a
                    key={chip.label}
                    href={chip.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 border border-[var(--lp-line)] bg-[var(--lp-vellum)] px-3 py-1.5 text-xs font-medium text-[var(--lp-ink)]/80 transition-colors hover:border-[var(--lp-brass)] hover:text-[var(--lp-brass-dim)]"
                  >
                    <span>{chip.label}</span>
                    <ArrowUpRightIcon className="size-3 text-[var(--lp-ink)]/40" />
                  </a>
                ))}
              </div>
            </div>

            <div className="flex min-h-[300px] flex-col justify-center overflow-hidden border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint)] p-4 sm:p-5">
              <LifecycleInteractiveVisual
                stageId={activeStage.id}
                interruptStatus={interruptStatus}
                setInterruptStatus={setInterruptStatus}
              />
            </div>
          </div>
        </section>

        {/* ── System Architecture Section ─────────────────────────────── */}
        <section id="architecture" className="border-t border-[var(--lp-line)] py-16 sm:py-20">
          <div className="flex flex-col items-start gap-2">
            <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-balance sm:text-3xl`}>
                  What's actually running underneath
                </h2>
                <p className="mt-1.5 max-w-xl text-[15px] text-[var(--lp-ink)]/70">
                  Four layers, each one swappable on its own. Pick a layer to see what lives there.
                </p>
              </div>
              <a
                href={`${DEV_DOCS_URL}/guides/integration-guide`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--lp-brass-dim)] hover:underline"
              >
                Read layer specifications
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-3">
              {ARCH_LAYERS.map((layer) => {
                const isSelected = selectedArchLayer === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedArchLayer(layer.id)}
                    className={`relative cursor-pointer border p-4 sm:p-5 transition-all ${
                      isSelected ? "border-[var(--lp-brass)] bg-[var(--lp-brass)]/8" : "border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/30 hover:border-[var(--lp-ink)]/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-[10px] font-semibold text-[var(--lp-ink)]/45">{layer.level}</span>
                        <h3 className="text-sm font-bold tracking-tight text-[var(--lp-ink)]">{layer.name}</h3>
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--lp-brass-dim)]">{layer.tag}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {layer.items.map((item) => (
                        <span key={item} className="border border-[var(--lp-line)] bg-[var(--lp-vellum)] px-2 py-0.5 font-mono text-[10px] text-[var(--lp-ink)]/60">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative flex flex-col justify-between border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/40 p-5 sm:p-6">
              <CornerTicks tone="light" />
              <div>
                <div className="flex items-center gap-2 border-b border-[var(--lp-line)] pb-3">
                  <CpuIcon className="size-5 text-[var(--lp-brass-dim)]" />
                  <span className="text-xs font-bold text-[var(--lp-ink)]/80">Layer capabilities</span>
                </div>

                <div className="mt-4 flex flex-col gap-4">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-[var(--lp-brass-dim)]">
                      {activeLayer.level} · {activeLayer.name}
                    </span>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--lp-ink)]/70 sm:text-sm">{activeLayer.summary}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-[var(--lp-ink)]">Included modules</span>
                    <ul className="space-y-1.5 text-xs text-[var(--lp-ink)]/65">
                      {activeLayer.items.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-[var(--lp-brass)]" />
                          <span className="font-mono text-[11px] text-[var(--lp-ink)]">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--lp-line)] pt-4">
                <a
                  href={activeLayer.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lp-brass-dim)] hover:underline"
                >
                  Read {activeLayer.name} documentation
                  <ArrowRightIcon className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Multi-Language Code Showcase ─────────────────────────────── */}
        <section id="sdks" className="border-t border-[var(--lp-line)] py-16 sm:py-20">
          <div className="flex flex-col items-start gap-2">
            <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-balance sm:text-3xl`}>
                  Ship with the language you already use
                </h2>
                <p className="mt-1.5 max-w-xl text-[15px] text-[var(--lp-ink)]/70">
                  Typed clients for TypeScript and Python, server adapters for the frameworks you're
                  already running, and a UI kit if you don't want to build the chat window yourself.
                </p>
              </div>
              <a
                href={`${DEV_DOCS_URL}/guides/sdk-quickstart`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--lp-brass-dim)] hover:underline"
              >
                Browse all SDK guides
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="relative mt-8 overflow-hidden border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/30">
            <div className="flex items-center justify-between border-b border-[var(--lp-line)] bg-[var(--lp-vellum-2)] px-3 py-2">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {CODE_SNIPPETS.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    onClick={() => setActiveCodeTab(snippet.id)}
                    className={`px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      activeCodeTab === snippet.id
                        ? "border-b-2 border-[var(--lp-brass)] bg-[var(--lp-vellum)] text-[var(--lp-ink)] font-semibold"
                        : "text-[var(--lp-ink)]/55 hover:text-[var(--lp-ink)]"
                    }`}
                  >
                    {snippet.title}
                  </button>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden font-mono text-[11px] text-[var(--lp-ink)]/45 md:inline">{activeSnippet.filename}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeSnippet.code, `code-${activeSnippet.id}`)}
                  className="flex items-center gap-1 border border-[var(--lp-line)] bg-[var(--lp-vellum)] px-2.5 py-1 text-xs text-[var(--lp-ink)]/60 transition-colors hover:text-[var(--lp-ink)]"
                >
                  {copiedKey === `code-${activeSnippet.id}` ? (
                    <>
                      <ChecksIcon className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" />
                      <span className="hidden sm:inline">Copy code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <HighlightedCode code={activeSnippet.code} lang={activeSnippet.lang} />

            <div className="flex flex-col items-start justify-between gap-2 border-t border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/50 px-4 py-2.5 text-xs sm:flex-row sm:items-center">
              <span className="text-[var(--lp-ink)]/60">
                Targeting <span className="font-semibold text-[var(--lp-ink)]">{activeSnippet.title}</span>
              </span>
              <a
                href={activeSnippet.docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--lp-brass-dim)] hover:underline"
              >
                Read documentation for {activeSnippet.title}
                <ArrowRightIcon className="size-3" />
              </a>
            </div>
          </div>
        </section>

        {/* ── shadcn Component Registry Section ────────────────────────── */}
        <section id="components" className="border-t border-[var(--lp-line)] py-16 sm:py-20">
          <div className="flex flex-col items-start gap-2">
            <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-balance sm:text-3xl`}>
                  Drop-in interface pieces
                </h2>
                <p className="mt-1.5 max-w-xl text-[15px] text-[var(--lp-ink)]/70">
                  Full components, not just tokens. Add a chat timeline, a sandboxed tool runner, a
                  code explorer, or a voice indicator with one shadcn command.
                </p>
              </div>
              <a
                href={`${DEV_DOCS_URL}/guides/ui/shadcn-registry`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--lp-brass-dim)] hover:underline"
              >
                Read registry docs
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {REGISTRY_ITEMS.map((item) => (
              <div key={item.name} className="relative flex flex-col justify-between border border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/30 p-5 sm:p-6">
                <CornerTicks tone="light" />
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center border border-[var(--lp-line)] bg-[var(--lp-vellum)]">
                      <item.icon className="size-5 text-[var(--lp-brass-dim)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--lp-ink)]">{item.title}</h3>
                      <span className="font-mono text-[10px] text-[var(--lp-ink)]/45">@personaai/ui/{item.name}</span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[var(--lp-ink)]/65">{item.description}</p>
                </div>

                <div className="mt-5 border-t border-[var(--lp-line)] pt-3">
                  <div className="flex items-center justify-between gap-2 bg-[var(--lp-vellum)] p-2 font-mono text-[11px]">
                    <span className="truncate text-[var(--lp-ink)]/60 select-all">{item.cmd}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.cmd, `registry-${item.name}`)}
                      className="shrink-0 p-1 text-[var(--lp-ink)]/50 hover:text-[var(--lp-ink)]"
                      title="Copy install command"
                    >
                      {copiedKey === `registry-${item.name}` ? (
                        <ChecksIcon className="size-3.5 text-emerald-600" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final Call to Action ─────────────────────────────────────── */}
        <section className="mb-16 mt-4 sm:mb-20">
          <div className="relative flex flex-col items-start justify-between gap-6 border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint)] p-6 sm:p-10 lg:flex-row lg:items-center">
            <CornerTicks tone="dark" />
            <div className="flex max-w-2xl flex-col gap-2.5">
              <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-balance text-[var(--lp-chalk)] sm:text-3xl`}>
                Build your first agent today
              </h2>
              <p className="text-sm leading-relaxed text-[var(--lp-chalk)]/70">
                Projects are free to start. Describe an agent, wire it to something real, and call
                it from your own code before the coffee's cold.
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              {isLoaded &&
                (signedIn ? (
                  <Button size="lg" className="w-full bg-[var(--lp-brass)] text-[var(--lp-blueprint-3)] hover:bg-[var(--lp-brass-dim)] sm:w-auto" render={<Link href="/projects" />}>
                    Go to your projects
                    <ArrowRightIcon className="size-4" />
                  </Button>
                ) : (
                  <Button size="lg" className="w-full bg-[var(--lp-brass)] text-[var(--lp-blueprint-3)] hover:bg-[var(--lp-brass-dim)] sm:w-auto" render={<Link href="/sign-up" />}>
                    Create free account
                    <ArrowRightIcon className="size-4" />
                  </Button>
                ))}

              <Button
                size="lg"
                variant="outline"
                className="w-full bg-transparent border-[var(--lp-line-dark)] text-[var(--lp-chalk)] hover:bg-white/5 sm:w-auto"
                render={<a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" />}
              >
                <BookOpenIcon className="size-4" />
                Developer docs
                <ArrowUpRightIcon className="size-3.5 text-[var(--lp-chalk)]/60" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="w-full border-t border-[var(--lp-line)] bg-[var(--lp-vellum-2)]/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <AppIcon className="size-6" />
                <span className={`${displayFont.className} text-sm font-semibold tracking-tight`}>Persona</span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-[var(--lp-ink)]/60">
                Persona is where you build AI agents, connect them to real tools and data, and
                ship them into your own product.
              </p>
              <div className="mt-1 text-[11px] text-[var(--lp-ink)]/45">Part of persona.hasanraiyan.me</div>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-semibold text-[var(--lp-ink)]/80">Product</span>
              <Link href="/projects" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Projects
              </Link>
              <Link href="/sign-up" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Agent Architect
              </Link>
              <a href="#how-it-works" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                How it works
              </a>
              <a href="#architecture" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Agent stack
              </a>
              <a href="#components" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                UI components
              </a>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-semibold text-[var(--lp-ink)]/80">Documentation</span>
              <a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Guides & tutorials
              </a>
              <a href={`${DEV_DOCS_URL}/guides/sdk-quickstart`} target="_blank" rel="noreferrer" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Node.js SDK
              </a>
              <a href={`${DEV_DOCS_URL}/guides/sdk-quickstart-python`} target="_blank" rel="noreferrer" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Python SDK
              </a>
              <a href={`${DEV_DOCS_URL}/guides/nextjs/quickstart`} target="_blank" rel="noreferrer" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Next.js adapter
              </a>
              <a href={`${DEV_DOCS_URL}/guides/ui/shadcn-registry`} target="_blank" rel="noreferrer" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                UI components
              </a>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-semibold text-[var(--lp-ink)]/80">Platform</span>
              <a href="mailto:support@persona.hasanraiyan.me" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Email support
              </a>
              <Link href="/sign-in" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Sign in
              </Link>
              <Link href="/sign-up" className="text-[var(--lp-ink)]/60 hover:text-[var(--lp-ink)]">
                Get started
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--lp-line)] pt-6 text-xs text-[var(--lp-ink)]/50">
            <span>© {new Date().getFullYear()} Persona AI. All rights reserved.</span>
            <a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--lp-brass-dim)] hover:underline">
              dev-docs.persona.hasanraiyan.me
              <ArrowUpRightIcon className="size-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Hero schematic — the one bold visual moment on the page. Shows the real
 * shape of the product: a brief compiles into an agent graph, which is
 * then called from the developer's own app. Deliberately not a fake IDE
 * window; it's closer to an annotated engineering drawing.
 */
function AgentSchematic() {
  return (
    <div className="relative border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint)] p-5 sm:p-7">
      <CornerTicks tone="dark" />

      {/* Title block, drafting-sheet convention */}
      <div className="absolute -top-3 right-4 flex divide-x divide-[var(--lp-line-dark)] border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-2)] text-[10px] text-[var(--lp-chalk)]/70 sm:right-6">
        <span className="px-2.5 py-1">Sheet: agent blueprint</span>
        <span className="flex items-center gap-1 px-2.5 py-1 text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Running live
        </span>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-0 sm:mt-3 md:flex-row">
        <SchematicNode
          icon={ChatCircleIcon}
          label="Your brief"
          detail={'"Handle billing questions using our refund policy and Stripe."'}
        />
        <SchematicConnector label="compiles into a graph" />
        <SchematicNode
          icon={CpuIcon}
          label="Agent"
          detail="Model, tools, and memory — tested live before anyone sees it."
        />
        <SchematicConnector label="ships as an endpoint" />
        <SchematicNode
          icon={PlugsConnectedIcon}
          label="Your product"
          detail="Called from your app with an SDK, adapter, or chat component."
        />
      </div>
    </div>
  );
}

function SchematicNode({
  icon: Icon,
  label,
  detail,
}: {
  icon: IconComponent;
  label: string;
  detail: string;
}) {
  return (
    <div className="relative flex-1 border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-2)]/60 p-4">
      <div className="flex items-center gap-2 text-[var(--lp-chalk)]">
        <Icon className="size-4 text-[var(--lp-brass)]" />
        <span className={`${displayFont.className} text-sm font-semibold`}>{label}</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--lp-chalk)]/65">{detail}</p>
    </div>
  );
}

function SchematicConnector({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-row items-center justify-center gap-2 py-2 md:flex-col md:gap-1.5 md:px-2 md:py-0">
      <ArrowRightIcon className="size-4 rotate-90 text-[var(--lp-slate)] md:rotate-0" />
      <span className="max-w-20 text-center text-[10px] leading-tight text-[var(--lp-slate)]">{label}</span>
    </div>
  );
}

/**
 * Dynamic interactive canvas for each "how it works" stage.
 */
function LifecycleInteractiveVisual({
  stageId,
  interruptStatus,
  setInterruptStatus,
}: {
  stageId: LifecycleStageId;
  interruptStatus: "pending" | "approved" | "rejected";
  setInterruptStatus: React.Dispatch<React.SetStateAction<"pending" | "approved" | "rejected">>;
}) {
  if (stageId === "describe") {
    return (
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[var(--lp-line-dark)] pb-2">
          <span className="text-[11px] text-[var(--lp-chalk)]/55">Agent Architect compilation</span>
          <span className="text-[10px] text-emerald-400">graph: compiled</span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="text-[var(--lp-chalk)]/60">
            <span className="text-[var(--lp-brass)]">&gt;</span> Defining system prompt with dynamic tool permissions
          </div>
          <div className="text-[var(--lp-chalk)]/60">
            <span className="text-[var(--lp-brass)]">&gt;</span> Initializing persistent state files:
          </div>
          <div className="pl-4 text-[10px] text-[var(--lp-chalk)]/80">
            ├── /memories/user/preferences.json <span className="text-[var(--lp-chalk)]/45">(shared)</span>
            <br />
            └── /memories/agent/checkpoint.bin <span className="text-[var(--lp-chalk)]/45">(scoped)</span>
          </div>
          <div className="mt-2 border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2 text-[var(--lp-chalk)]/85">
            <span className="font-bold text-[var(--lp-brass)]">Agent graph compiled:</span> 3 nodes, 2 tools, 1 memory checkpoint.
          </div>
        </div>
      </div>
    );
  }

  if (stageId === "connect") {
    return (
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[var(--lp-line-dark)] pb-2">
          <span className="text-[11px] text-[var(--lp-chalk)]/55">Grounding topology</span>
          <span className="text-[10px] text-[var(--lp-brass)]">MCP · RAG · REST</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px]">
          <div className="border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--lp-brass)]">
              <PlugsConnectedIcon className="size-3.5" />
              <span>Stripe MCP</span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--lp-chalk)]/55">
              Transport: SSE / OAuth2
              <br />
              Tools: refund, invoice, subscription
            </div>
          </div>
          <div className="border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <BookOpenIcon className="size-3.5" />
              <span>Qdrant vector KB</span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--lp-chalk)]/55">
              Collection: policy_docs_v1
              <br />
              Chunks: 4,821 · hybrid RAG
            </div>
          </div>
        </div>
        <div className="border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2 text-[10px] text-[var(--lp-chalk)]/60">
          <span className="text-emerald-400">● 100% tool resolution:</span> queries validated with Zod descriptors before the model runs.
        </div>
      </div>
    );
  }

  if (stageId === "test") {
    return (
      <div className="flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-[var(--lp-line-dark)] pb-2 font-mono">
          <span className="text-[11px] text-[var(--lp-chalk)]/55">Live trace — refund_specialist_v2</span>
          <span className="text-[10px] text-emerald-400 animate-pulse">● 48 tokens/sec</span>
        </div>

        <div className="ml-auto max-w-[90%] bg-[var(--lp-brass)] p-2.5 text-[var(--lp-blueprint-3)]">
          Wire the agent to return policy RAG and the Stripe refund MCP server.
        </div>

        <div className="max-w-[95%] border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2.5 leading-relaxed text-[var(--lp-chalk)]/80">
          Bound <span className="font-semibold text-[var(--lp-brass)]">Return Policy RAG (Qdrant)</span> and{" "}
          <span className="font-mono text-[10px] border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-2)] px-1 py-0.5">stripe_mcp::refund_order</span>. Running a trial:
        </div>

        <div className="border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-mono text-amber-300">
              <WrenchIcon className="size-3.5" />
              <span className="truncate">stripe_mcp.refund_order</span>
            </div>
            <span
              className={`font-mono text-[10px] ${
                interruptStatus === "approved" ? "text-emerald-400" : interruptStatus === "rejected" ? "text-red-400" : "text-amber-300"
              }`}
            >
              {interruptStatus === "approved" ? "status: authorized" : interruptStatus === "rejected" ? "status: blocked" : "interrupt: pending"}
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-2 border-t border-[var(--lp-line-dark)] pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-[var(--lp-chalk)]/60">Authorize $49.00 refund to order #9102?</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setInterruptStatus("approved")}
                className={`border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                  interruptStatus === "approved"
                    ? "border-emerald-400 bg-emerald-400 text-[var(--lp-blueprint-3)]"
                    : "border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-2)] text-[var(--lp-chalk)]/70 hover:border-emerald-400 hover:text-emerald-300"
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setInterruptStatus("rejected")}
                className={`border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                  interruptStatus === "rejected"
                    ? "border-red-400 bg-red-400 text-[var(--lp-blueprint-3)]"
                    : "border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-2)] text-[var(--lp-chalk)]/70 hover:border-red-400 hover:text-red-300"
                }`}
              >
                Reject
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--lp-chalk)]/45">
            Ask the Architect to tune instructions, or test it yourself in the playground...
          </span>
          <span className="grid size-6 shrink-0 place-items-center bg-[var(--lp-brass)] text-[var(--lp-blueprint-3)]">
            <ArrowUpIcon className="size-3.5" />
          </span>
        </div>
      </div>
    );
  }

  if (stageId === "ship") {
    return (
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[var(--lp-line-dark)] pb-2">
          <span className="text-[11px] text-[var(--lp-chalk)]/55">Production integration</span>
          <span className="text-[10px] text-[var(--lp-brass)]">no plumbing required</span>
        </div>
        <div className="bg-[#0d1117] p-3 text-[11px] text-[#c9d1d9] overflow-x-auto">
          <span className="text-[#8b949e]">// 1. Server route handler:</span>
          <br />
          <span className="text-[#ff7b72]">export const</span> &#123; GET, POST &#125; = adapter.handlers;
          <br />
          <br />
          <span className="text-[#8b949e]">// 2. Frontend React UI:</span>
          <br />
          &lt;<span className="text-[#7ee787]">AgentChat</span> agentId=<span className="text-[#a5d6ff]">&quot;refund_specialist&quot;</span> /&gt;
        </div>
        <div className="text-[10px] text-[var(--lp-chalk)]/55">
          ✓ Works with the Next.js App Router, Express, NestJS, and standalone React apps.
        </div>
      </div>
    );
  }

  // protect
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[var(--lp-line-dark)] pb-2">
        <span className="text-[11px] text-[var(--lp-chalk)]/55">Security & tenant boundary</span>
        <span className="text-[10px] text-emerald-400">AES-256-GCM</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2">
          <span className="text-[var(--lp-chalk)]/75">Project ID</span>
          <span className="text-[var(--lp-chalk)]/50">prj_enterprise_live_01</span>
        </div>
        <div className="flex items-center justify-between border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2">
          <span className="text-[var(--lp-chalk)]/75">Encrypted keys</span>
          <span className="font-bold text-emerald-400">14 / 14 encrypted</span>
        </div>
        <div className="flex items-center justify-between border border-[var(--lp-line-dark)] bg-[var(--lp-blueprint-3)] p-2">
          <span className="text-[var(--lp-chalk)]/75">Audit trail</span>
          <span className="text-[var(--lp-chalk)]/50">immutable (1,290 events)</span>
        </div>
      </div>
      <div className="text-[10px] text-[var(--lp-chalk)]/55">✓ Role-based access: admin, developer, and read-only.</div>
    </div>
  );
}

export { LandingPage };
