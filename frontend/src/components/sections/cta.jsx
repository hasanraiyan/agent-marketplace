import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { ArrowRightIcon } from "lucide-react";

// All seven real categories from the Discover feed / Index section, copy
// matched to categories.jsx exactly. Avatars use the product's real default
// (agent.model.js's DiceBear fallback, the same art every agent gets until
// it has a custom photo) — not a fake identity, not a live fetch against a
// DB that currently has zero public agents.
//
// Positioned as a physical deck: all cards centered on the same point,
// each offset a little and rotated a different amount, stacked by
// z-index — the front card sits straightest and is the most legible, the
// rest peek out at sharper angles further back.
const ctaCards = [
  {
    tag: "Health & Fitness",
    line: "Build a routine, read your labs, stay consistent.",
    seed: "health-fitness",
    z: "z-10",
    fanClass: "translate-x-[-56px] translate-y-[-36px] rotate-[-12deg]",
  },
  {
    tag: "Entrepreneurship",
    line: "Pressure-test a pitch, price a product, plan a launch.",
    seed: "entrepreneurship",
    z: "z-[14]",
    fanClass: "translate-x-[46px] translate-y-[-44px] rotate-[9deg]",
  },
  {
    tag: "Mind & Behavior",
    line: "Reframe a thought, sit with a decision.",
    seed: "mind-behavior",
    z: "z-[18]",
    fanClass: "translate-x-[-40px] translate-y-[14px] rotate-[-7deg]",
  },
  {
    tag: "Careers",
    line: "Rewrite a resume, rehearse an interview.",
    seed: "careers",
    z: "z-[22]",
    fanClass: "translate-x-[52px] translate-y-[6px] rotate-[8deg]",
  },
  {
    tag: "The Library of Minds",
    line: "Historical thinkers and working experts, reconstructed.",
    seed: "library-of-minds",
    z: "z-[26]",
    fanClass: "translate-x-[-20px] translate-y-[40px] rotate-[-4deg]",
  },
  {
    tag: "Life & Relationships",
    line: "Talk through a conflict, plan a hard conversation.",
    seed: "life-relationships",
    z: "z-40",
    fanClass: "translate-x-[6px] translate-y-[-6px] rotate-[-1deg]",
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
          <div className="relative hidden h-[26rem] lg:block">
            {ctaCards.map((card) => (
              // Outer: centers every card on the same point. Inner: the
              // per-card fan offset/rotation. Kept as two elements so hover
              // can reset just the inner transform without fighting the
              // centering transform on the same element.
              <div
                key={card.tag}
                className={`absolute top-1/2 left-1/2 h-64 w-52 -translate-x-1/2 -translate-y-1/2 hover:z-50 ${card.z}`}
              >
                <div
                  className={`size-full transition-transform duration-300 hover:translate-x-0 hover:translate-y-0 hover:rotate-0 ${card.fanClass}`}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
