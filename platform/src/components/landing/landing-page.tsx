"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  ChatCircleIcon,
  ChecksIcon,
  CopyIcon,
  CpuIcon,
  FolderIcon,
  MicrophoneIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
  SparkleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { AppIcon } from "@/components/layout/app-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

const DEV_DOCS_URL = "https://dev-docs.persona.hasanraiyan.me";

/* ── Syntax Highlighting & Shiki Cache ────────────────────────────────── */
type HighlighterInstance = Awaited<ReturnType<typeof import("shiki")["createHighlighter"]>>;
let highlighterPromise: Promise<HighlighterInstance> | null = null;
const highlightCache = new Map<string, string>();

async function getHighlighter(): Promise<HighlighterInstance> {
  if (!highlighterPromise) {
    const { createHighlighter } = await import("shiki");
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript", "tsx"],
    });
  }
  return highlighterPromise;
}

/* ── Code Snippets ─────────────────────────────────────────────────────── */
const SNIPPETS = [
  {
    id: "react",
    label: "React Component",
    lang: "tsx",
    file: "components/chat-view.tsx",
    code: `import { AgentChat } from "@/components/chat";

export function SupportWidget() {
  return (
    <AgentChat
      agentId="agent_refund_specialist"
      apiUrl="/api/persona/agui"
      features={{
        toolExecutionCards: true,
        reasoningBlock: true,
        mcpExtApps: true,
      }}
    />
  );
}`,
  },
  {
    id: "nextjs",
    label: "Next.js Adapter",
    lang: "typescript",
    file: "app/api/persona/[...persona]/route.ts",
    code: `import { createNextServerAdapter } from "@personaai/adapters/nextjs/server";
import { auth } from "@/lib/auth";

const adapter = createNextServerAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  // Automatically scopes threads and memory per user:
  resolveUserFrom: async (req) => (await auth(req))?.userId ?? null,
});

export const { GET, POST } = adapter.handlers;`,
  },
  {
    id: "typescript",
    label: "TypeScript SDK",
    lang: "typescript",
    file: "run-agent.ts",
    code: `import { PersonaClient } from "@personaai/sdk";

const client = new PersonaClient({
  baseUrl: "https://api.persona.hasanraiyan.me",
  credential: process.env.PERSONA_CREDENTIAL!,
  externalUserId: "usr_1042",
});

const stream = client.chat.stream("agent_refund_specialist", {
  messages: [{ role: "user", content: "Check refund status for #8102" }],
});

for await (const chunk of stream) {
  if (chunk.type === "TEXT_MESSAGE_CHUNK") process.stdout.write(chunk.delta);
}`,
  },
];

/* ── Code Shimmer Loading Skeleton ─────────────────────────────────────── */
function CodeShimmer() {
  const lineSkeletonWidths = [45, 65, 82, 58, 28, 88, 62, 48, 74, 52];
  return (
    <div className="space-y-2.5 bg-[#0d1117] p-4 sm:p-5 font-mono text-xs">
      {lineSkeletonWidths.map((width, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="w-5 text-right text-xs text-white/20 select-none">{idx + 1}</span>
          <div
            className="h-3.5 animate-pulse rounded-xs bg-white/10"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Syntax Highlighted Code Viewer ───────────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const cacheKey = `${lang}:${code}`;
  const [asyncHtml, setAsyncHtml] = React.useState<string>("");
  const cachedHtml = highlightCache.get(cacheKey);
  const html = cachedHtml || asyncHtml;
  const isLoading = !html;

  React.useEffect(() => {
    if (highlightCache.has(cacheKey)) return;

    let cancelled = false;
    getHighlighter()
      .then((hl) => {
        if (cancelled) return;
        try {
          const out = hl.codeToHtml(code, {
            lang,
            theme: "github-dark",
          });
          highlightCache.set(cacheKey, out);
          setAsyncHtml(out);
        } catch {
          // ignore
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [code, lang, cacheKey]);

  if (isLoading) {
    return <CodeShimmer />;
  }

  if (!html) {
    return (
      <div className="overflow-x-auto bg-[#0d1117] p-4 sm:p-5 font-mono text-xs leading-relaxed text-[#c9d1d9]">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto bg-[#0d1117]">
      <style>{`
        .shiki-code-pane code {
          counter-reset: step;
          counter-increment: step 0;
        }
        .shiki-code-pane .line::before {
          content: counter(step);
          counter-increment: step;
          width: 1.25rem;
          margin-right: 1.25rem;
          display: inline-block;
          text-align: right;
          color: rgba(255, 255, 255, 0.22);
          user-select: none;
        }
      `}</style>
      <div
        className="shiki-code-pane text-xs leading-relaxed [&_pre]:!bg-[#0d1117] [&_pre]:!p-4 sm:[&_pre]:!p-5 [&_pre]:font-mono [&_pre]:!m-0 [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ── Registry Showcase Items ───────────────────────────────────────────── */
const REGISTRY_ITEMS = [
  {
    name: "chat",
    title: "Agent Chat Timeline",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/chat.json",
    desc: "Complete AG-UI streaming timeline with tool cards, subagent drawer, and reasoning indicators.",
    icon: ChatCircleIcon,
  },
  {
    name: "mcp-app",
    title: "MCP Ext-App Runner",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/mcp-app.json",
    desc: "Sandboxed iframe runner with bidirectional AppBridge for interactive Model Context Protocol tools.",
    icon: PlugsConnectedIcon,
  },
  {
    name: "file-explorer",
    title: "Code & File Explorer",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/file-explorer.json",
    desc: "Workspace code browser and editor with tabs, syntax highlighting, and save/discard actions.",
    icon: FolderIcon,
  },
  {
    name: "voice-indicator",
    title: "Voice Audio Visualizer",
    cmd: "npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/voice-indicator.json",
    desc: "Real-time waveform visualizer with active speech detection and connection state indicators.",
    icon: MicrophoneIcon,
  },
];

/**
 * Persona Developer Platform — Clean, minimal, high-clarity landing page.
 */
function LandingPage() {
  const { isLoaded, user } = useUser();
  const signedIn = !!user;

  const [activeCodeTab, setActiveCodeTab] = React.useState("react");
  const [heroView, setHeroView] = React.useState<"ui" | "code">("ui");
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [composerInput, setComposerInput] = React.useState("");

  // Preload all snippet highlights on mount
  React.useEffect(() => {
    getHighlighter()
      .then((hl) => {
        for (const item of SNIPPETS) {
          const key = `${item.lang}:${item.code}`;
          if (!highlightCache.has(key)) {
            try {
              const out = hl.codeToHtml(item.code, {
                lang: item.lang,
                theme: "github-dark",
              });
              highlightCache.set(key, out);
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeSnippet = SNIPPETS.find((s) => s.id === activeCodeTab) ?? SNIPPETS[0];

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* Background ambient radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
      />

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <AppIcon className="size-5" />
              <span>Persona</span>
            </Link>

            <nav className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#code" className="transition-colors hover:text-foreground">
                Integration
              </a>
              <a href="#components" className="transition-colors hover:text-foreground">
                UI Registry
              </a>
              <a
                href={DEV_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
              >
                Docs
                <ArrowUpRightIcon className="size-3 text-muted-foreground" />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isLoaded &&
              (signedIn ? (
                <Button size="sm" render={<Link href="/projects" />}>
                  Console
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
                    Sign in
                  </Button>
                  <Button size="sm" render={<Link href="/sign-up" />}>
                    Get started
                    <ArrowRightIcon className="size-3.5" />
                  </Button>
                </>
              ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* ── Hero Section ──────────────────────────────────────────── */}
        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="flex flex-col items-start gap-5">
            <Badge variant="secondary" className="gap-1.5">
              <SparkleIcon className="size-3 text-primary" />
              Developer Platform & Agent Runtime
            </Badge>

            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Ship production AI agents into your product.
            </h1>

            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Build agents with natural language or code, ground them with real-world MCP tools and
              vector search, and embed streaming chat into your app with drop-in components.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" render={<Link href={signedIn ? "/projects" : "/sign-up"} />}>
                {signedIn ? "Open Console" : "Start building — free"}
                <ArrowRightIcon className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" />}
              >
                <BookOpenIcon className="size-4" />
                Documentation
              </Button>
            </div>

            {/* 1-Click Install Command */}
            <div className="flex items-center gap-2 border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-xs">
              <span className="text-primary select-none">$</span>
              <span className="select-all">npm i @personaai/sdk</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => copyText("npm i @personaai/sdk", "hero-sdk")}
                title="Copy install command"
              >
                {copiedKey === "hero-sdk" ? (
                  <ChecksIcon className="size-3 text-emerald-500" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Hero Visual: Component vs Code Toggle */}
          <Card className="flex flex-col h-[385px] overflow-hidden p-0 py-0 gap-0 shadow-xs">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <AppIcon className="size-4" />
                <span className="text-xs font-semibold">Refund Assistant</span>
                <Badge variant="outline" className="gap-1 text-[10px] text-emerald-500 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AG-UI Live
                </Badge>
              </div>
              <div className="flex items-center rounded-md bg-muted p-0.5 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setHeroView("ui")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
                    heroView === "ui"
                      ? "bg-background text-foreground shadow-xs"
                      : "hover:text-foreground"
                  )}
                >
                  UI Component
                </button>
                <button
                  type="button"
                  onClick={() => setHeroView("code")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
                    heroView === "code"
                      ? "bg-background text-foreground shadow-xs"
                      : "hover:text-foreground"
                  )}
                >
                  Server Stream
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 overflow-hidden">
              {heroView === "ui" ? (
                <div className="flex flex-1 flex-col justify-between gap-3">
                  <div className="flex flex-col gap-3">
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end" variant="default">
                          <BubbleContent>Can you inspect return eligibility for order #8102?</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>

                    <Message align="start">
                      <MessageContent>
                        <Item variant="outline" size="sm" className="w-full justify-between bg-muted/30">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ItemMedia variant="icon">
                              <WrenchIcon className="size-3.5 text-primary" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="font-mono text-xs">
                                check_refund_eligibility
                              </ItemTitle>
                              <ItemDescription className="font-mono text-[11px] truncate">
                                {"{ orderId: '8102' }"}
                              </ItemDescription>
                            </ItemContent>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-emerald-500 font-mono shrink-0">
                            completed
                          </Badge>
                        </Item>

                        <div className="mt-1 text-xs sm:text-sm text-foreground leading-relaxed">
                          Order #8102 is eligible for a full refund under the standard 30-day window. Would you like me to process the $49.00 credit to Stripe?
                        </div>
                      </MessageContent>
                    </Message>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setComposerInput("");
                    }}
                    className="mt-auto"
                  >
                    <InputGroup className="bg-background">
                      <InputGroupTextarea
                        value={composerInput}
                        onChange={(e) => setComposerInput(e.target.value)}
                        placeholder="Ask anything…"
                        rows={1}
                        className="max-h-24 text-xs"
                      />
                      <InputGroupAddon align="block-end" className="justify-end">
                        <InputGroupButton
                          type="submit"
                          variant="default"
                          size="icon-sm"
                          aria-label="Send message"
                          className={composerInput.trim() ? undefined : "opacity-40"}
                        >
                          <ArrowUpIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </form>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-between gap-3">
                  <div className="space-y-1.5 font-mono text-xs leading-relaxed text-muted-foreground bg-[#0d1117] p-4 border border-border">
                    <div className="text-primary font-semibold">{"// 3 lines to stream real-time agent output:"}</div>
                    <div>
                      <span className="text-foreground">const stream</span> = persona.chat.stream(&quot;refund_agent&quot;, &#123;
                    </div>
                    <div className="pl-4">
                      messages: [&#123; role: &quot;user&quot;, content: &quot;Check order #8102&quot; &#125;],
                    </div>
                    <div>&#125;);</div>
                    <br />
                    <div>
                      <span className="text-foreground">for await</span> (const chunk of stream) &#123;
                    </div>
                    <div className="pl-4">
                      process.stdout.write(chunk.delta);
                    </div>
                    <div>&#125;</div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span>Real-time AG-UI event streaming (SSE)</span>
                    <span className="font-mono text-emerald-500">● 48 tokens/sec</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* ── Tech Compatibility Strip ──────────────────────────────── */}
        <section className="border-y border-border py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Model-agnostic and built on open standards:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                "Claude Sonnet 5",
                "GPT-6 Astra",
                "Gemini 3.8 Flash",
                "Model Context Protocol",
                "AG-UI Protocol",
                "LangGraph",
              ].map((t) => (
                <Badge key={t} variant="secondary" className="font-normal text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3 Core Pillars ────────────────────────────────────────── */}
        <section id="features" className="py-16 sm:py-20">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              Platform
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything needed to take agents from prompt to production
            </h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="flex flex-col justify-between p-5 py-5 gap-0">
              <div className="space-y-2.5">
                <div className="grid size-8 place-items-center border border-border bg-muted">
                  <PlugsConnectedIcon className="size-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Connect & Ground</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Plug in any Model Context Protocol server over stdio or SSE. Ground responses in
                  project-scoped Qdrant vector knowledge, or expose schema-validated REST tools.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                <Badge variant="outline" className="text-[10px]">MCP Stdio / SSE</Badge>
                <Badge variant="outline" className="text-[10px]">Vector RAG</Badge>
                <Badge variant="outline" className="text-[10px]">Zod REST Tools</Badge>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 py-5 gap-0">
              <div className="space-y-2.5">
                <div className="grid size-8 place-items-center border border-border bg-muted">
                  <CpuIcon className="size-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Observable Runtime</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Low-latency streaming over the AG-UI SSE protocol. Durable multi-turn thread
                  checkpoints, persistent memory files, and human-in-the-loop action approvals.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                <Badge variant="outline" className="text-[10px]">AG-UI Streaming</Badge>
                <Badge variant="outline" className="text-[10px]">Memory Files</Badge>
                <Badge variant="outline" className="text-[10px]">Human Interrupts</Badge>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 py-5 gap-0">
              <div className="space-y-2.5">
                <div className="grid size-8 place-items-center border border-border bg-muted">
                  <ShieldCheckIcon className="size-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Enterprise Isolation</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Multi-tenant isolation per Project. Every API key and OAuth token is encrypted
                  at rest with AES-256-GCM. Tamper-evident audit logs record every mutation.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                <Badge variant="outline" className="text-[10px]">AES-256-GCM</Badge>
                <Badge variant="outline" className="text-[10px]">Role-based Access</Badge>
                <Badge variant="outline" className="text-[10px]">Audit Logs</Badge>
              </div>
            </Card>
          </div>
        </section>

        {/* ── Code Integration Showcase ─────────────────────────────── */}
        <section id="code" className="border-t border-border py-16 sm:py-20">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              Integration
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Integrate in your stack with typed SDKs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              One shared runtime callable from React, Next.js, and Node.js.
            </p>
          </div>

          <Card className="mt-6 overflow-hidden p-0 py-0 gap-0 border border-border bg-[#0d1117]">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {SNIPPETS.map((tab) => {
                  const isActive = activeCodeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCodeTab(tab.id)}
                      className={cn(
                        "relative px-3 py-2.5 text-xs font-medium transition-colors outline-none",
                        isActive
                          ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                          : "text-muted-foreground hover:text-white"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 py-1.5">
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                  {activeSnippet.file}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => copyText(activeSnippet.code, `code-${activeSnippet.id}`)}
                  className="h-7 text-xs text-muted-foreground hover:bg-white/10 hover:text-white"
                >
                  {copiedKey === `code-${activeSnippet.id}` ? (
                    <>
                      <ChecksIcon className="size-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <CodeBlock code={activeSnippet.code} lang={activeSnippet.lang} />
          </Card>
        </section>

        {/* ── shadcn Component Registry Showcase ───────────────────── */}
        <section id="components" className="border-t border-border py-16 sm:py-20">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              Registry
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Drop-in shadcn UI components
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Install pre-built agent UI directly into your own codebase with zero CSS conflicts.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {REGISTRY_ITEMS.map((item) => (
              <Card key={item.name} className="flex flex-col justify-between p-4 py-4 gap-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-7 place-items-center border border-border bg-muted">
                      <item.icon className="size-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold">{item.title}</h3>
                      <span className="font-mono text-[10px] text-muted-foreground">@personaai/ui/{item.name}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-2.5 py-1.5 font-mono text-[11px]">
                  <span className="truncate text-muted-foreground select-all">{item.cmd}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => copyText(item.cmd, `reg-${item.name}`)}
                    title="Copy command"
                  >
                    {copiedKey === `reg-${item.name}` ? (
                      <ChecksIcon className="size-3 text-emerald-500" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Final Call to Action ──────────────────────────────────── */}
        <section className="mb-16 mt-4 sm:mb-20">
          <Card className="relative overflow-hidden p-6 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 bg-[radial-gradient(50%_50%_at_50%_50%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
            />
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Build your first agent today
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Free to start. Create a project, connect your tools, and stream agents into your app.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <Button size="lg" render={<Link href={signedIn ? "/projects" : "/sign-up"} />}>
                  {signedIn ? "Open Console" : "Create free account"}
                  <ArrowRightIcon className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  render={<a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" />}
                >
                  <BookOpenIcon className="size-4" />
                  Docs
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="w-full border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <AppIcon className="size-4" />
            <span className="font-semibold text-foreground">Persona</span>
            <span className="hidden sm:inline">· Developer Platform</span>
          </div>

          <div className="flex items-center gap-4">
            <a href={DEV_DOCS_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Docs
            </a>
            <Link href="/projects" className="hover:text-foreground">
              Console
            </Link>
            <a href="mailto:support@persona.hasanraiyan.me" className="hover:text-foreground">
              Support
            </a>
            <span>© {new Date().getFullYear()} Persona AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { LandingPage };
