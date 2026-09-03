"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  BriefcaseIcon,
  LayoutDashboardIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Overview", href: studioRoutes.firm, exact: true, icon: LayoutDashboardIcon },
  { label: "Projects", href: studioRoutes.firmProjects, icon: PackageIcon },
  { label: "Team", href: studioRoutes.firmTeam, icon: UsersIcon },
  { label: "Clients", href: studioRoutes.firmClients, icon: BriefcaseIcon },
];

/**
 * Segmented sub-navigation shared by every /studio/firm/* screen.
 */
export function FirmNav({ className }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="My Firm sections"
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-slate-150/70 bg-slate-100/70 p-1 dark:border-slate-850/60 dark:bg-slate-900/60",
        className,
      )}
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors",
              active
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
            )}
          >
            {active ? (
              <motion.span
                layoutId="firm-nav-pill"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-full bg-white shadow-xs dark:bg-slate-800"
              />
            ) : null}
            <Icon
              className={cn(
                "relative size-3.5",
                active ? "text-[#1E60FF]" : "text-slate-400 dark:text-slate-500",
              )}
            />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
