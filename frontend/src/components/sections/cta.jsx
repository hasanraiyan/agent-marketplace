import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";

export function CTASection() {
  return (
    <section className="relative overflow-hidden border-t border-zinc-200 bg-[#FBFAF7] py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-3xl border border-zinc-200 bg-white px-8 py-14 sm:px-14 sm:py-20 lg:grid-cols-2">
          <div className="relative z-10 flex flex-col items-start gap-6">
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

          {/* One giant typographic accent, not a cluster of small pieces —
              sized to fully fit the column instead of bleeding past the
              card's own overflow-hidden edge and getting hard-clipped. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-center justify-center lg:flex"
          >
            <span className="font-display rotate-[-4deg] text-[9rem] leading-none font-semibold whitespace-nowrap text-[#1E60FF]/10 italic select-none">
              Talk.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
