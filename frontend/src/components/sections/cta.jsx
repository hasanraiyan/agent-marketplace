import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { ArrowRightIcon } from "lucide-react";

// The three categories the Hero's own card stack didn't cover — completes
// coverage across the page instead of repeating the same set. Avatars use
// the product's real default (agent.model.js's DiceBear fallback, the same
// art every agent gets until it has a custom photo) — not a fake identity,
// not a live fetch against a DB that currently has zero public agents.
//
// Positioned as a physical deck: all three centered on the same point,
// each offset a little and rotated a different amount, stacked by z-index
// — the front card sits straightest and is the most legible, the two
// behind it peek out at sharper angles.
const ctaCards = [
  {
    tag: "Health & Fitness",
    line: "Build a routine, read your labs, stay consistent.",
    seed: "health-fitness",
    wrapClass:
      "left-1/2 top-1/2 -translate-x-[calc(50%+32px)] -translate-y-[calc(50%+18px)] rotate-[-9deg] z-10",
  },
  {
    tag: "Mind & Behavior",
    line: "Reframe a thought, sit with a decision.",
    seed: "mind-behavior",
    wrapClass:
      "left-1/2 top-1/2 -translate-x-[calc(50%-26px)] -translate-y-[calc(50%-10px)] rotate-[7deg] z-20",
  },
  {
    tag: "Life & Relationships",
    line: "Talk through a conflict, plan a hard conversation.",
    seed: "life-relationships",
    wrapClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] z-30",
  },
];

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1e60ff,154ed0,0a2a80`;
}

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

          {/* Photo-card deck — same TiltCard treatment as Discover's
              Featured Minds (image, gradient overlay, text at the bottom),
              stacked like a small pile of photos instead of spread out. */}
          <div className="relative hidden h-72 lg:block">
            {ctaCards.map((card) => (
              <div
                key={card.tag}
                className={`absolute h-64 w-52 transition-transform duration-300 hover:z-40 hover:rotate-0 ${card.wrapClass}`}
              >
                <TiltCard
                  maxTilt={10}
                  className="size-full overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl(card.seed)}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 text-white">
                    <p className="font-mono text-[10px] tracking-[0.14em] text-white/70 uppercase">
                      {card.tag}
                    </p>
                    <p className="font-display mt-1 text-sm leading-snug font-medium">
                      {card.line}
                    </p>
                  </div>
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
