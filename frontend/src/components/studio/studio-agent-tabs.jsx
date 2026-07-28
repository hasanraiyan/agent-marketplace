"use client";

import Link from "next/link";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", href: studioRoutes.agent },
  { key: "build", label: "Build", href: studioRoutes.agentBuild },
  { key: "test", label: "Test", href: studioRoutes.agentTest },
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
          href={tab.href(agentId)}
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
