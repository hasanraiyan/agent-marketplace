import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { ArrowRightIcon } from "lucide-react";

// All seven real categories from the Discover feed / Index section, copy
// matched to categories.jsx exactly — Technology and Careers each split
// into their two real halves instead of duplicated or invented, to reach
// enough cards for a full ring without ever showing the same content twice.
// Avatars use the product's real default (agent.model.js's DiceBear
// fallback, the same art every agent gets until it has a custom photo) —
// not a fake identity, not a live fetch against a DB that currently has
// zero public agents.
const ctaCards = [
  {
    tag: "Health & Fitness",
    line: "Build a routine, read your labs, stay consistent.",
    seed: "health-fitness",
  },
  {
    tag: "Entrepreneurship",
    line: "Pressure-test a pitch, price a product, plan a launch.",
    seed: "entrepreneurship",
  },
  {
    tag: "Mind & Behavior",
    line: "Reframe a thought, understand a pattern, sit with a decision.",
    seed: "mind-behavior",
  },
  {
    tag: "Technology",
    line: "Debug a stack trace.",
    seed: "technology-1",
  },
  {
    tag: "Life & Relationships",
    line: "Talk through a conflict, plan a hard conversation.",
    seed: "life-relationships",
  },
  {
    tag: "The Library of Minds",
    line: "Historical thinkers and working experts, reconstructed.",
    seed: "library-of-minds",
  },
  {
    tag: "Careers",
    line: "Rewrite a resume, rehearse an interview.",
    seed: "careers-1",
  },
  {
    tag: "Technology",
    line: "Review an architecture, learn a tool.",
    seed: "technology-2",
  },
  {
    tag: "Careers",
    line: "Plan the next move.",
    seed: "careers-2",
  },
];

const RADIUS = 112;

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

          {/* Auto-rotating card ring — same TiltCard treatment as
              Discover's Featured Minds. Pauses on hover; see globals.css
              for the counter-rotation that keeps cards upright while the
              ring turns, and the prefers-reduced-motion override. */}
          <div className="orbit-wrap relative hidden h-[26rem] lg:block">
            <div className="orbit-ring absolute inset-0">
              {ctaCards.map((card, i) => {
                const angle = (360 / ctaCards.length) * i;
                return (
                  <div
                    key={`${card.tag}-${card.seed}`}
                    className="absolute top-1/2 left-1/2 h-44 w-36"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${RADIUS}px) rotate(${-angle}deg)`,
                    }}
                  >
                    <div className="orbit-card-counter size-full">
                      <TiltCard
                        maxTilt={8}
                        className="size-full overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarUrl(card.seed)}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        <div className="absolute inset-x-3 bottom-3 text-white">
                          <p className="font-mono text-[9px] tracking-[0.12em] text-white/70 uppercase">
                            {card.tag}
                          </p>
                          <p className="font-display mt-1 text-xs leading-snug font-medium">
                            {card.line}
                          </p>
                        </div>
                      </TiltCard>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
