"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", segment: "" },
  { key: "build", label: "Build", segment: "/build" },
  { key: "test", label: "Test", segment: "/test" },
];

/**
 * Workspace navigation for a single agent inside Studio. Rendered into the
 * shared header's `tabs` slot so it reads as one workspace rather than three
 * unrelated pages.
 */
export function StudioAgentTabs({ agentId, active }) {
  return (
    <nav className="flex h-8 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/studio/agents/${agentId}${tab.segment}`}
          className={cn(
            "h-7 rounded-md px-3 text-xs leading-7 font-semibold transition-colors",
            active === tab.key
              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-slate-50"
              : "text-slate-550 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
