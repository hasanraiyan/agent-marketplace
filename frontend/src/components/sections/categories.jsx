import Link from "next/link";
import {
  RocketIcon,
  HeartPulseIcon,
  BrainIcon,
  CpuIcon,
  UsersIcon,
  LibraryIcon,
  BriefcaseIcon,
  ArrowRightIcon,
} from "lucide-react";

// Mirrors the CATEGORIES filter on /dashboard (frontend/src/app/dashboard/page.jsx)
// — the real taxonomy the Discover feed uses today, not an invented list.
const categories = [
  {
    icon: RocketIcon,
    label: "Entrepreneurship",
    line: "Pressure-test a pitch, price a product, plan a launch.",
  },
  {
    icon: HeartPulseIcon,
    label: "Health & Fitness",
    line: "Build a routine, read your labs, stay consistent.",
  },
  {
    icon: BrainIcon,
    label: "Mind & Behavior",
    line: "Reframe a thought, understand a pattern, sit with a decision.",
  },
  {
    icon: CpuIcon,
    label: "Technology",
    line: "Debug a stack trace, review an architecture, learn a tool.",
  },
  {
    icon: UsersIcon,
    label: "Life & Relationships",
    line: "Talk through a conflict, plan a hard conversation.",
  },
  {
    icon: LibraryIcon,
    label: "The Library of Minds",
    line: "Historical thinkers and working experts, reconstructed.",
  },
  {
    icon: BriefcaseIcon,
    label: "Careers",
    line: "Rewrite a resume, rehearse an interview, plan the move.",
  },
];

export function CategoriesSection() {
  return (
    <section id="categories" className="relative bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col items-start gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
            The Index
          </span>
          <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Seven ways in, one honest question each.
          </h2>
        </div>

        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.label}
              href="/dashboard"
              className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-8 transition-colors hover:border-[#1E60FF]/40"
            >
              <cat.icon className="size-5 text-zinc-400 transition-colors group-hover:text-[#1E60FF]" />
              <div>
                <p className="text-base font-semibold text-zinc-900">
                  {cat.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                  {cat.line}
                </p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors group-hover:text-[#1E60FF]">
                Browse
                <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
