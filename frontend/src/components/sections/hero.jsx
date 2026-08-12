import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { HScroller } from "@/components/h-scroller";
import { ArrowRightIcon, PlayCircleIcon } from "lucide-react";

// Same seven categories the product actually ships in the Discover feed
// (frontend/src/app/dashboard/page.jsx) — kept in sync by hand since that
// list isn't exported as a shared module. Avatars use the product's real
// default (agent.model.js's DiceBear fallback, the same art every agent
// gets until it has a custom photo) — not a fake identity, not a live
// fetch against a DB that currently has zero public agents.
const heroCards = [
  {
    label: "Technology",
    line: "Debug a stack trace, review an architecture.",
    seed: "technology",
  },
  {
    label: "Careers",
    line: "Rewrite a resume, rehearse an interview.",
    seed: "careers",
  },
  {
    label: "The Library of Minds",
    line: "Historical thinkers, reconstructed for conversation.",
    seed: "library-of-minds",
  },
  {
    label: "Entrepreneurship",
    line: "Pressure-test a pitch, price a product.",
    seed: "entrepreneurship",
  },
];

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1e60ff,154ed0,0a2a80`;
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-white pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-index-rule opacity-[0.35]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Copy ─────────────────────────────────────────── */}
        <div className="animate-fade-up flex max-w-2xl flex-col items-start text-left">
          <span className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
            <span className="size-1.5 rounded-full bg-[#1E60FF]" />
            Persona.ai — an index of minds
          </span>

          <h1 className="font-display max-w-xl text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-zinc-900 sm:text-6xl">
            Talk to minds who&apos;ve <em className="italic">actually</em> done
            it.
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-zinc-500 sm:text-lg">
            Discover AI agents built around real expertise across a dozen
            categories — or open Agent Studio and build your own with the model,
            skills, and knowledge you choose.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-12 gap-2 rounded-full bg-[#1E60FF] px-7 text-base text-white shadow-md shadow-[#1E60FF]/20 transition-all hover:scale-[1.02] hover:bg-[#154ed0] active:scale-[0.98]"
              asChild
            >
              <Link href="/sign-up">
                Start talking — it&apos;s free
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 gap-2 rounded-full px-5 text-base text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              asChild
            >
              <a href="#how-it-works">
                <PlayCircleIcon className="size-4" />
                See how it works
              </a>
            </Button>
          </div>

          <p className="mt-7 font-mono text-xs tracking-wide text-zinc-400">
            Bring your own OpenAI · Anthropic · Gemini · DeepSeek key when you
            build
          </p>
        </div>

        {/* ── The Index (card row) ──────────────────────────
            Same HScroller + TiltCard + photo-card pattern as Discover's
            Featured Minds row (image, gradient overlay, text at the
            bottom) — swipes on mobile, arrow controls at md+ — instead
            of a one-off fanned/absolute layout that broke at tablet and
            small-laptop widths. */}
        <div
          className="animate-fade-up mt-16"
          style={{ animationDelay: "0.15s" }}
        >
          <HScroller count={heroCards.length}>
            {heroCards.map((card) => (
              <TiltCard
                key={card.label}
                maxTilt={8}
                className="h-64 w-52 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-lg sm:h-72 sm:w-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl(card.seed)}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-white/70 uppercase">
                    Mind — {card.label}
                  </p>
                  <p className="font-display mt-1.5 text-base leading-snug font-medium">
                    {card.line}
                  </p>
                </div>
              </TiltCard>
            ))}
          </HScroller>
        </div>
      </div>
    </section>
  );
}
