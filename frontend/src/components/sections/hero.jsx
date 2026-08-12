import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { ArrowRightIcon, PlayCircleIcon } from "lucide-react";

// Same seven categories the product actually ships in the Discover feed
// (frontend/src/app/dashboard/page.jsx) — kept in sync by hand since that
// list isn't exported as a shared module.
const heroCards = [
  {
    label: "Technology",
    line: "Debug a stack trace, review an architecture.",
    rotate: "lg:rotate-[-6deg]",
  },
  {
    label: "Careers",
    line: "Rewrite a resume, rehearse an interview.",
    rotate: "lg:rotate-[3deg]",
  },
  {
    label: "The Library of Minds",
    line: "Historical thinkers, reconstructed for conversation.",
    rotate: "lg:rotate-[-2deg]",
  },
  {
    label: "Entrepreneurship",
    line: "Pressure-test a pitch, price a product.",
    rotate: "lg:rotate-[8deg]",
  },
];

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-white pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-index-rule opacity-[0.35]" />

      <div className="relative mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-8 lg:px-8">
        {/* ── Copy ─────────────────────────────────────────── */}
        <div className="animate-fade-up flex flex-col items-start text-left">
          <span className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
            <span className="size-1.5 rounded-full bg-[#1E60FF]" />
            Persona.ai — an index of minds
          </span>

          <h1 className="font-display max-w-xl text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-zinc-900 sm:text-6xl">
            Talk to minds who&apos;ve <em className="italic">actually</em>{" "}
            done it.
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-zinc-500 sm:text-lg">
            Discover AI agents built around real expertise across a dozen
            categories — or open Agent Studio and build your own with the
            model, skills, and knowledge you choose.
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

        {/* ── The Index (fanned mind cards) ───────────────── */}
        <div
          className="animate-fade-up relative flex gap-4 overflow-x-auto pb-4 lg:h-[420px] lg:justify-center lg:overflow-visible lg:pb-0"
          style={{ animationDelay: "0.15s" }}
        >
          {heroCards.map((card, i) => (
            <TiltCard
              key={card.label}
              maxTilt={8}
              className={`w-56 shrink-0 rounded-2xl border border-zinc-200 bg-[#FBFAF7] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-lg lg:absolute lg:w-64 lg:shrink ${card.rotate} lg:hover:z-20 lg:hover:rotate-0`}
              style={{
                top: `${i * 22}%`,
                left: `${i % 2 === 0 ? 10 : 40}%`,
              }}
            >
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#1E60FF] uppercase">
                Mind — {card.label}
              </span>
              <p className="font-display mt-3 text-lg leading-snug font-medium text-zinc-800">
                {card.line}
              </p>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
