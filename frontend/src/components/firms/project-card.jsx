"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatPrice } from "./utils";
import { personaRoutes } from "@/lib/studio-routes";

/**
 * A FirmProject template as sold on the storefront. The outcome is the
 * promise; the price + duration are the terms.
 */
export function ProjectCard({ firmSlug, project, className }) {
  const href = personaRoutes.firmProject(firmSlug, project.slug);
  const duration = formatDuration(project.durationDays);
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col rounded-[24px] border border-zinc-100 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-[0_12px_40px_-16px_rgba(24,24,27,0.18)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base leading-snug font-semibold tracking-tight text-zinc-900">
          {project.title}
        </h3>
        <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums">
          {formatPrice(project.price)}
        </span>
      </div>
      {project.outcome && (
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed font-medium text-zinc-500">
          {project.outcome}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
          {duration && (
            <>
              <CalendarClock className="size-3.5" />
              {duration}
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#1E60FF]">
          View
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
