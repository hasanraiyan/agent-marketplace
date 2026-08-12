"use client";

import Link from "next/link";
import { CompassIcon, HammerIcon, SparklesIcon, BracesIcon } from "lucide-react";

const capabilities = [
  {
    icon: CompassIcon,
    tag: "Discover",
    line: "Browse minds by category, start talking instantly.",
  },
  {
    icon: HammerIcon,
    tag: "Build",
    line: "Pick a provider, attach Skills and Knowledge, ship a mind in Studio.",
  },
  {
    icon: SparklesIcon,
    tag: "Architect",
    line: "Describe what you want — a co-pilot writes the system prompt with you.",
  },
  {
    icon: BracesIcon,
    tag: "Develop",
    line: "Embed Persona's agents in your own product with the SDK.",
  },
];

function Logo({ dark }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-[#1E60FF]" />
      <span
        className={`font-display text-xl font-semibold tracking-tight ${dark ? "text-white" : "text-zinc-900"}`}
      >
        Persona
        <span className={dark ? "text-white/40" : "text-zinc-400"}>.ai</span>
      </span>
    </Link>
  );
}

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Feature panel (desktop only) ─────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#14161C] p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-index-rule opacity-[0.06]" />

        <Logo dark />

        <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
            An index of minds
          </p>
          <h1 className="font-display mt-4 max-w-sm text-4xl leading-[1.1] font-semibold text-white">
            Talk to minds who&apos;ve <em className="italic">actually</em>{" "}
            done it.
          </h1>

          <ul className="mt-10 flex flex-col gap-6">
            {capabilities.map((c) => (
              <li key={c.tag} className="flex gap-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <c.icon className="size-4 text-white/70" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{c.tag}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/50">
                    {c.line}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/30">
          &copy; {new Date().getFullYear()} Persona.ai
        </p>
      </div>

      {/* ── Auth content ──────────────────────────────────── */}
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-index-rule opacity-[0.35] lg:hidden" />

        <div className="relative z-10 mb-8 lg:hidden">
          <Logo />
        </div>

        <main className="relative z-10 flex w-full justify-center">
          {children}
        </main>

        <div className="relative z-10 mt-10 text-center text-xs text-zinc-400 lg:hidden">
          &copy; {new Date().getFullYear()} Persona.ai
        </div>
      </div>
    </div>
  );
}
