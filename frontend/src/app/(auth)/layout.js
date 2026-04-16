"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";

export default function AuthLayout({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* ── Background Effects ──────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        {/* Decorative Orbs */}
        <div className="animate-pulse-glow absolute -top-32 -left-32 size-96 rounded-full bg-primary/10" />
        <div
          className="animate-pulse-glow absolute -right-24 bottom-1/4 size-80 rounded-full bg-chart-2/10"
          style={{ animationDelay: "2s" }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/20 to-background" />
      </div>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative z-10 mb-10">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 transition-all group-hover:bg-primary/25 group-hover:ring-primary/50 group-hover:shadow-lg group-hover:shadow-primary/20">
            <SparklesIcon className="size-6 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            Persona<span className="gradient-text">.ai</span>
          </span>
        </Link>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <main className="relative z-10 w-full px-4 sm:flex sm:justify-center">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="relative z-10 mt-10 text-center text-sm text-muted-foreground/60">
        &copy; {new Date().getFullYear()} Persona.ai. All rights reserved.
      </div>
    </div>
  );
}
