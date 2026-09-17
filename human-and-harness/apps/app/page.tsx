import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  PackageCheck,
  PlayCircle,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const orgChart = [
  {
    icon: Briefcase,
    title: "Consultancy",
    description:
      'The published firm a client meets on the marketplace — e.g. "FitWithAlex AI Fitness Consultancy."',
  },
  {
    icon: Bot,
    title: "AI Consultant",
    description:
      "The lead agent. Runs discovery, scopes the work, and routes tasks to the right specialists.",
  },
  {
    icon: Users,
    title: "Subagents",
    description:
      "Specialists the lead calls on — a nutrition agent, a workout-planning agent, and so on.",
  },
  {
    icon: Wrench,
    title: "Skills & tools",
    description:
      "Playbooks and integrations (MCPs, calendars, data sources) subagents use to actually do the work.",
  },
];

const engagementSteps = [
  {
    icon: MessageSquare,
    title: "Conversation",
    description: "Describe your problem. The lead consultant asks the discovery questions a real expert would.",
  },
  {
    icon: FileText,
    title: "Scope of work",
    description: "You get an explicit SoW — what's included, what isn't — before any work starts.",
  },
  {
    icon: PlayCircle,
    title: "Execution",
    description: "The lead routes work to subagents, skills, and tools. If it gets stuck, the creator steps in.",
  },
  {
    icon: PackageCheck,
    title: "Deliverable",
    description: "You get a real output, not a transcript — and a clear review step to approve or request changes.",
  },
];

const creatorPoints = [
  "Build your consultancy conversationally — describe your expertise and Agent Architect drafts the lead agent, subagents, and positioning.",
  "Attach the skills, tools, and MCPs your practice already runs on.",
  "See who's engaging your firm and what problems they're bringing you.",
  "You're the fallback on your own firm — if the AI can't finish something, you can step in and still deliver.",
];

const clientPoints = [
  "Browse consultancies by the problem you actually have, not by which bot sounds friendliest.",
  "Every engagement starts with a scope of work you approve — no surprise scope creep.",
  "Work is done by a firm: a lead consultant plus the specialists and tools it needs.",
  "If the AI can't complete the job, a human behind the firm does — you always get a deliverable.",
];

const faqs = [
  {
    question: "What's the difference between a Task, Project, and Case?",
    answer:
      "A Task is a single, bounded ask with one deliverable and minimal scoping. A Project spans several deliverables or milestones over time. Case is the broader term for an engagement of either kind, or open-ended diagnostic work — your consultancy picks the right shape when you describe the problem.",
  },
  {
    question: "What happens if the AI can't complete my request?",
    answer:
      "Every consultancy has a human fallback behind it — the creator who built the firm. If the AI consultant can't finish the work, the engagement doesn't just dead-end; the creator is brought in to complete it, so you still get a real deliverable.",
  },
  {
    question: "Can a creator see who's talking to their AI consultancy?",
    answer:
      "Yes. Creators get visibility into the problems clients are bringing to their firm, so they can improve the consultancy's skills and subagents over time based on real engagements.",
  },
  {
    question: "Do I need to know how to build AI agents to become a Creator?",
    answer:
      "No. Agent Architect is conversational — you describe your expertise, your services, and how you'd tackle problems in your field, and it drafts the lead consultant, subagent breakdown, and positioning for you to refine.",
  },
  {
    question: "Is anything deployed outside the platform?",
    answer:
      "Not in this release. Consultancies, engagements, and deliverables all live on Humans & Harness — no external deployment or custom domains yet.",
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <div className="dark flex flex-1 flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Link href="#" className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center bg-primary text-primary-foreground">
              <Bot className="size-3.5" />
            </span>
            Humans &amp; Harness
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-medium text-muted-foreground sm:flex">
            <Link href="#how-it-works" className="hover:text-foreground">How it works</Link>
            <Link href="#creators" className="hover:text-foreground">For creators</Link>
            <Link href="#clients" className="hover:text-foreground">For clients</Link>
            <Link href="#faq" className="hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Sign in</Button>
            <Button size="sm">
              Get started
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
          />
          <div className="absolute left-1/2 top-0 -z-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/30 blur-[110px]" />

          <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
            <Badge variant="secondary">AI consultancy marketplace</Badge>
            <h1 className="max-w-3xl font-heading text-5xl font-semibold tracking-tight sm:text-6xl">
              Turn your expertise into an AI consultancy firm.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Not a single chatbot — a real firm. A lead AI consultant, specialist subagents,
              skills, and tools, scoped and delivered like a real engagement — backed by a human
              whenever the AI can&rsquo;t finish the job.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button size="lg">
                Become a Creator
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button size="lg" variant="outline">Browse consultancies</Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-foreground" /> Scope of work before work starts
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-foreground" /> Real deliverables, not chat logs
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-foreground" /> Human fallback guaranteed
              </span>
            </div>
          </div>

          {/* Product preview — an illustrative mockup, not a real captured engagement */}
          <div className="relative mx-auto mt-16 w-full max-w-4xl px-6">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              Illustrative example — not a real engagement or user data.
            </p>
            <Card className="overflow-hidden border-none bg-white text-zinc-950 shadow-2xl shadow-black/40 ring-1 ring-black/10">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-400" />
                  <span className="size-2.5 rounded-full bg-amber-400" />
                  <span className="size-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="justify-self-center font-mono text-[0.65rem] text-zinc-400">
                  app.humansandharness.ai
                </span>
              </div>
              <CardHeader className="border-b border-zinc-200 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center bg-primary/10 text-primary">
                      <Bot className="size-3.5" />
                    </div>
                    <CardTitle className="text-zinc-950">FitWithAlex AI Fitness Consultancy</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-950">Example</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 pt-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="ml-auto max-w-[90%] bg-zinc-100 px-3 py-2 text-xs text-zinc-950">
                    I want to lose weight before summer, but past diets never stuck.
                  </div>
                  <div className="max-w-[90%] bg-primary/10 px-3 py-2 text-xs text-zinc-950">
                    Got it. Before we start, here&rsquo;s the scope of work I&rsquo;d propose &mdash;
                    take a look.
                  </div>
                  <div className="mt-2 flex flex-col gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-primary" />
                      <span className="text-zinc-500">Scope approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-primary" />
                      <span className="text-zinc-500">Subagents executing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PackageCheck className="size-3.5 text-primary" />
                      <span className="font-medium text-zinc-950">Deliverable ready for review</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 ring-1 ring-zinc-200 p-3">
                  <div className="flex items-center gap-1.5 text-[0.65rem] font-medium tracking-wide text-zinc-500 uppercase">
                    <FileText className="size-3" /> Scope of work
                  </div>
                  <dl className="mt-2 flex flex-col gap-2 text-xs">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-zinc-500">Deliverable</dt>
                      <dd className="text-zinc-950">12-week nutrition + training plan</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-zinc-500">Includes</dt>
                      <dd className="text-zinc-950">Weekly check-ins, macro adjustments</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-zinc-500">Excludes</dt>
                      <dd className="text-zinc-950">Medical diagnosis, meal delivery</dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Org chart / concept hierarchy */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Structure</Eyebrow>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              An org chart, not a prompt box
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Every consultancy on Humans &amp; Harness is built from the same four layers —
              the same way a real firm is structured.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orgChart.map((item, i) => (
              <div key={item.title} className="relative">
                <Card className="h-full transition-colors hover:ring-primary/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex size-8 items-center justify-center bg-primary/10 text-primary">
                        <item.icon className="size-4" />
                      </div>
                      <span className="font-mono text-[0.65rem] text-muted-foreground">0{i + 1}</span>
                    </div>
                    <CardTitle className="pt-2 text-sm">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
                {i < orgChart.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-muted-foreground lg:block" />
                )}
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Engagement flow */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Process</Eyebrow>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              How an engagement works
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              From first message to finished deliverable, every engagement follows the same
              four steps.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {engagementSteps.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center bg-foreground text-background">
                    <step.icon className="size-4" />
                  </div>
                  {i < engagementSteps.length - 1 && (
                    <div className="hidden h-px flex-1 bg-border lg:block" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Fallback guarantee */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <Card className="relative overflow-hidden border-none bg-primary/10 ring-primary/25">
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/20 blur-3xl" />
            <CardContent className="relative flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
              <div className="flex size-12 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <Eyebrow>Guarantee</Eyebrow>
                <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                  AI-first execution. Human-backed guarantee.
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  The AI consultant and its subagents do the work first. If they can&rsquo;t complete
                  it, the engagement doesn&rsquo;t just stall out — the creator behind that firm steps
                  in and finishes it manually. You never end a conversation with &ldquo;sorry, the AI
                  got stuck.&rdquo; You get a deliverable, full stop.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Audience tabs */}
        <section id="creators" className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Audience</Eyebrow>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for both sides of the engagement
            </h2>
          </div>
          <Tabs defaultValue="creators" className="mx-auto mt-10 max-w-3xl">
            <TabsList id="clients" className="mx-auto">
              <TabsTrigger value="creators">For creators</TabsTrigger>
              <TabsTrigger value="clients">For clients</TabsTrigger>
            </TabsList>
            <TabsContent value="creators">
              <Card>
                <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                  {creatorPoints.map((point) => (
                    <div key={point} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p className="text-sm text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="clients">
              <Card>
                <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                  {clientPoints.map((point) => (
                    <div key={point} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p className="text-sm text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-20">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>
          <Accordion className="mt-10" defaultValue={["item-0"]}>
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.question} value={`item-${i}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>
                  <p>{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <Separator />

        {/* Final CTA */}
        <section className="relative mx-auto w-full max-w-6xl px-6 py-24">
          <div className="relative mx-auto max-w-2xl overflow-hidden bg-secondary/50 p-10 text-center ring-1 ring-border sm:p-14">
            <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
            <div className="relative flex flex-col items-center gap-6">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Ready to build your firm?
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Start with Agent Architect — describe your expertise, and it drafts your
                consultancy for you to refine and publish.
              </p>
              <Button size="lg">
                Become a Creator
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span className="flex size-5 items-center justify-center bg-primary text-primary-foreground">
              <Bot className="size-3" />
            </span>
            Humans &amp; Harness
          </div>
          <p>&copy; {new Date().getFullYear()} Humans &amp; Harness. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
