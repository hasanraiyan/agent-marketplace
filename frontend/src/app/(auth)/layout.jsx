"use client";

import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white py-12">
      <div className="pointer-events-none absolute inset-0 bg-index-rule opacity-[0.35]" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative z-10 mb-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#1E60FF]" />
          <span className="font-display text-xl font-semibold tracking-tight text-zinc-900">
            Persona<span className="text-zinc-400">.ai</span>
          </span>
        </Link>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <main className="relative z-10 w-full px-4 sm:flex sm:justify-center">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="relative z-10 mt-10 text-center text-xs text-zinc-400">
        &copy; {new Date().getFullYear()} Persona.ai
      </div>
    </div>
  );
}
