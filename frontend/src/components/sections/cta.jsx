import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRightIcon,
  HeartPulseIcon,
  BrainIcon,
  UsersIcon,
} from "lucide-react";

// The three categories the Hero's card stack didn't use — completes
// coverage across the page instead of repeating the same set.
const ctaCards = [
  {
    icon: HeartPulseIcon,
    tag: "Health & Fitness",
    line: "Build a routine, read your labs, stay consistent.",
    position: "left-[4%] top-[4%] lg:rotate-[-5deg]",
  },
  {
    icon: BrainIcon,
    tag: "Mind & Behavior",
    line: "Reframe a thought, sit with a decision.",
    position: "left-[32%] top-[30%] lg:rotate-[4deg]",
  },
  {
    icon: UsersIcon,
    tag: "Life & Relationships",
    line: "Talk through a conflict, plan a hard conversation.",
    position: "left-[10%] top-[56%] lg:rotate-[-2deg]",
  },
];

export function CTASection() {
  return (
    <section className="relative border-t border-zinc-200 bg-[#FBFAF7] py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 overflow-hidden rounded-3xl border border-zinc-200 bg-white px-8 py-14 sm:px-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          {/* Text */}
          <div className="flex flex-col items-start gap-6">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
              Get started
            </span>
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl">
              Find a mind worth talking to.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-zinc-500 sm:text-lg">
              Free to start, no credit card. Bring your own model key when
              you&apos;re ready to build one.
            </p>
            <Button
              size="lg"
              className="h-12 gap-2 rounded-full bg-[#1E60FF] px-7 text-base text-white shadow-md shadow-[#1E60FF]/20 transition-all hover:scale-[1.02] hover:bg-[#154ed0] active:scale-[0.98]"
              asChild
            >
              <Link href="/sign-up">
                Start talking
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>

          {/* Avatar-card stack */}
          <div className="relative hidden h-96 lg:block">
            {ctaCards.map((card) => (
              <div
                key={card.tag}
                className={`absolute w-52 rounded-2xl border border-zinc-200 bg-[#FBFAF7] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform duration-300 hover:z-10 hover:rotate-0 ${card.position}`}
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-[#1E60FF]/10">
                  <card.icon className="size-4 text-[#1E60FF]" />
                </div>
                <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
                  {card.tag}
                </p>
                <p className="font-display mt-1 text-sm leading-snug font-medium text-zinc-800">
                  {card.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
