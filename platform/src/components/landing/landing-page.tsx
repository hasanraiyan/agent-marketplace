"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowUpIcon,
  BookOpenIcon,
  ChatCircleIcon,
  KeyIcon,
  PlugsConnectedIcon,
  RobotIcon,
  SparkleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { AppIcon } from "@/components/layout/app-icon";
import { Button } from "@/components/ui/button";

type IconComponent = React.ComponentType<{ className?: string }>;

const FEATURES: { icon: IconComponent; title: string; body: string }[] = [
  {
    icon: RobotIcon,
    title: "Agents, built by conversation",
    body: "Describe what an agent should do and the Agent Architect creates it — or edits an existing one — wired to your Project’s tools and knowledge.",
  },
  {
    icon: ChatCircleIcon,
    title: "A live Playground",
    body: "Test any agent over chat or voice before you ship it, watching every tool call and interrupt as it runs.",
  },
  {
    icon: BookOpenIcon,
    title: "Knowledge bases",
    body: "Give agents RAG knowledge they answer from, stored and scoped to the Project.",
  },
  {
    icon: SparkleIcon,
    title: "Skills",
    body: "Package reusable capabilities once and let any of your agents use them.",
  },
  {
    icon: WrenchIcon,
    title: "Tools and connectors",
    body: "Define REST tools, connect MCP servers, and wire RCP sources — the real-world actions your agents can take.",
  },
  {
    icon: KeyIcon,
    title: "Credentials and access",
    body: "Mint API credentials per Project, store secrets separately, manage admins, and keep a full audit trail.",
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Create a Project",
    body: "An independent workspace that consumes Persona under your own identity — with its own admins, credentials, and resources.",
  },
  {
    n: "02",
    title: "Describe your agent",
    body: "Tell the Agent Architect what you want in plain language. It builds the agent against this Project’s tools and knowledge; tune it in the Playground over chat and voice.",
  },
  {
    n: "03",
    title: "Call it from your app",
    body: "Integrate with @personaai/sdk (TypeScript), persona-agent-sdk (Python), or the REST API — with adapters for Next.js, Express, and NestJS.",
  },
];

const STUDIO_NAV: { icon: IconComponent; label: string; active?: boolean }[] = [
  { icon: ChatCircleIcon, label: "Playground", active: true },
  { icon: RobotIcon, label: "Agents" },
  { icon: BookOpenIcon, label: "Knowledge" },
  { icon: PlugsConnectedIcon, label: "MCP" },
  { icon: SparkleIcon, label: "Skills" },
];

/**
 * Public product page for Persona’s developer platform (the route that used
 * to hard-redirect to /projects). Marketing copy only — no API calls — so it
 * renders fine signed-out; the header and CTA switch on auth state.
 */
function LandingPage() {
  const { isLoaded, user } = useUser();
  const signedIn = !!user;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Decorative backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <AppIcon className="size-7" />
          <span className="text-sm font-semibold tracking-tight">Persona</span>
          <span className="text-xs text-muted-foreground">developer platform</span>
        </div>
        {isLoaded &&
          (signedIn ? (
            <Button render={<Link href="/projects" />}>Open your Studio</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" render={<Link href="/sign-in" />}>
                Sign in
              </Button>
              <Button render={<Link href="/sign-up" />}>Get started</Button>
            </div>
          ))}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="border border-border bg-card px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              Agents for your product
            </span>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
              Build agents once.
              <br />
              Call them from{" "}
              <span className="text-primary">your app</span>.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
              Create a Project on Persona’s agent infrastructure, build and
              tune agents by conversation, wire them to your skills,
              knowledge, and tools — then integrate them into your own
              platform with an SDK or the REST API.
            </p>
            <div className="flex min-h-9 flex-wrap items-center gap-3">
              {isLoaded &&
                (signedIn ? (
                  <Button size="lg" render={<Link href="/projects" />}>
                    Open your Studio
                  </Button>
                ) : (
                  <>
                    <Button size="lg" render={<Link href="/sign-up" />}>
                      Start building
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      render={<Link href="/sign-in" />}
                    >
                      Sign in
                    </Button>
                  </>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Every Project gets real admins, credentials, secrets, and an
              audit trail from day one.
            </p>
          </div>

          {/* Studio preview */}
          <StudioPreview />
        </section>

        {/* ── Capabilities ─────────────────────────────────────────────── */}
        <section className="border-t border-border py-16 lg:py-20">
          <div className="flex flex-col items-start gap-2">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              What you get
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Everything a real integration needs
            </h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-none border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-2.5 bg-card p-6"
              >
                <f.icon className="size-5 text-primary" />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="border-t border-border py-16 lg:py-20">
          <div className="flex flex-col items-start gap-2">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              How it works
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              From idea to production in three steps
            </h2>
          </div>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col items-start gap-3">
                <span className="text-3xl font-semibold tracking-tight text-primary/70">
                  {s.n}
                </span>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="mb-20 mt-4">
          <div className="flex flex-col items-start gap-6 border border-border bg-card p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                Start your first Project
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Projects are free to create. Describe an agent, test it in the
                Playground, and call it from your code.
              </p>
            </div>
            <div className="min-h-9 shrink-0">
              {isLoaded &&
                (signedIn ? (
                  <Button size="lg" render={<Link href="/projects" />}>
                    Go to your Projects
                  </Button>
                ) : (
                  <Button size="lg" render={<Link href="/sign-up" />}>
                    Create your account
                  </Button>
                ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-2.5">
            <AppIcon className="size-5" />
            <span className="text-xs font-semibold">Persona</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Agent marketplace · Studio · Developer platform — one shared agent
            runtime.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StudioPreview() {
  return (
    <div className="relative">
      {/* soft glow under the panel */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 bg-[radial-gradient(50%_50%_at_50%_50%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <div className="overflow-hidden rounded-none border border-border bg-card shadow-sm">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5">
            <AppIcon className="size-4" />
            <span className="text-xs font-medium">persona · studio</span>
          </div>
          <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            developer
          </span>
        </div>

        <div className="flex">
          {/* left nav */}
          <div className="hidden w-40 shrink-0 flex-col gap-0.5 border-r border-border p-2 sm:flex">
            {STUDIO_NAV.map((item) => (
              <div
                key={item.label}
                className={
                  item.active
                    ? "flex items-center gap-1.5 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary"
                    : "flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground"
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </div>
            ))}
          </div>

          {/* chat */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Agent Architect</span>
              <span className="text-[10px] text-muted-foreground">
                shared project thread
              </span>
            </div>

            <div className="flex max-w-[85%] flex-col gap-2 bg-muted p-2.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                I’ll create a support agent named{" "}
                <span className="font-medium text-foreground">
                  Refund Helper
                </span>{" "}
                with a knowledge base over your policy and a{" "}
                <span className="font-mono text-[10px]">get_refund_status</span>{" "}
                tool — then you can test it right here.
              </p>
            </div>

            <div className="ml-auto flex max-w-[75%] flex-col gap-1 bg-primary p-2.5 text-primary-foreground">
              <p className="text-[11px] leading-relaxed">
                Create an agent that answers refund questions from our policy.
              </p>
            </div>

            {/* composer */}
            <div className="mt-1 flex items-center gap-2 border border-border bg-background p-2">
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                Refine the agent so it can check order status…
              </span>
              <span className="grid size-6 shrink-0 place-items-center bg-primary text-primary-foreground">
                <ArrowUpIcon className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { LandingPage };
