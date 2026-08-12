import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CompassIcon,
  HammerIcon,
  BracesIcon,
  ArrowRightIcon,
} from "lucide-react";

const paths = [
  {
    icon: CompassIcon,
    tag: "For anyone",
    title: "Discover",
    description:
      "Browse minds by category and start a conversation instantly. Sign in only when you want to save it.",
    cta: "Open Discover",
    href: "/dashboard",
  },
  {
    icon: HammerIcon,
    tag: "For creators",
    title: "Agent Studio",
    description:
      "Describe the mind you want in plain language and the Architect co-pilot builds it with you — or configure the system prompt, provider, and tools by hand.",
    cta: "Open Studio",
    href: "/studio",
  },
  {
    icon: BracesIcon,
    tag: "For developers",
    title: "Developer Platform",
    description:
      "Create a Project, mint an API credential, and embed Persona's agents in your own product with the SDK.",
    cta: "Open Developer Studio",
    href: "/developer",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative border-t border-zinc-200 bg-[#FBFAF7] py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col items-start gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
            How it works
          </span>
          <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Three ways in, one platform underneath.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {paths.map((path) => (
            <div
              key={path.title}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-8"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#1E60FF]/10">
                <path.icon className="size-5 text-[#1E60FF]" />
              </div>
              <span className="mt-6 font-mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                {path.tag}
              </span>
              <h3 className="font-display mt-2 text-2xl font-semibold text-zinc-900">
                {path.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-500">
                {path.description}
              </p>
              <Button
                variant="ghost"
                className="mt-6 justify-start gap-1.5 self-start px-0 text-sm font-medium text-zinc-700 hover:bg-transparent hover:text-[#1E60FF]"
                asChild
              >
                <Link href={path.href}>
                  {path.cta}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
