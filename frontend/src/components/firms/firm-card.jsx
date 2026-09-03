"use client";

import Link from "next/link";
import { ArrowUpRight, Layers } from "lucide-react";
import { TiltCard } from "@/components/ui/tilt-card";
import { cn } from "@/lib/utils";
import { FirmAvatar } from "./firm-avatar";
import { categoryLabel } from "./utils";
import { personaRoutes } from "@/lib/studio-routes";

function projectCountLabel(n) {
  const count = n || 0;
  return `${count} ${count === 1 ? "project" : "projects"}`;
}

/**
 * Featured rail card: tall image card with a gradient scrim, name/tagline,
 * and a hover reveal of what the firm knows.
 */
export function FirmFeaturedCard({ firm, onClick }) {
  const image = firm.coverImage || firm.avatar;
  const chips = (firm.expertise || []).slice(0, 3);
  return (
    <TiltCard
      onClick={onClick}
      className="group relative h-[255px] w-[190px] shrink-0 cursor-pointer overflow-hidden rounded-[24px] bg-zinc-900 sm:h-[310px] sm:w-[230px] sm:rounded-[32px]"
    >
      {image ? (
        <img
          src={image}
          alt={firm.name}
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E60FF] via-[#1b4fd6] to-zinc-900" />
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 sm:top-5 sm:left-5">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase backdrop-blur-sm">
          {categoryLabel(firm.category)}
        </span>
      </div>

      <div className="absolute right-4 bottom-4 left-4 z-20 flex flex-col justify-end text-white transition-opacity duration-300 select-none group-hover:opacity-0 sm:right-6 sm:bottom-6 sm:left-6">
        <h3 className="font-display text-lg leading-none font-semibold tracking-tight sm:text-2xl">
          {firm.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug font-medium text-white/80 sm:text-[13px]">
          {firm.tagline}
        </p>
        <p className="mt-2 text-[10px] font-bold tracking-wide text-white/60 uppercase">
          {projectCountLabel(firm.projectCount)}
        </p>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:inset-x-6 sm:bottom-6">
        <div className="rounded-2xl rounded-bl-none bg-white/95 px-3.5 py-3 backdrop-blur-sm">
          <p className="mb-1.5 text-[10px] font-bold tracking-wide text-zinc-400 uppercase">
            What we know
          </p>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-zinc-800">
              {firm.tagline}
            </p>
          )}
        </div>
      </div>
    </TiltCard>
  );
}

/**
 * Grid card for the "All firms" section.
 */
export function FirmCard({ firm, className }) {
  const chips = (firm.expertise || []).slice(0, 3);
  return (
    <Link
      href={personaRoutes.firm(firm.slug)}
      className={cn(
        "group flex h-full flex-col rounded-[24px] border border-zinc-100 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-[0_12px_40px_-16px_rgba(24,24,27,0.18)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <FirmAvatar firm={firm} className="size-12" />
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition-colors group-hover:bg-[#1E60FF]/10 group-hover:text-[#1E60FF]">
          <Layers className="size-3" />
          {projectCountLabel(firm.projectCount)}
        </span>
      </div>
      <div className="mt-4 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display truncate text-base font-semibold tracking-tight text-zinc-900">
            {firm.name}
          </h3>
          <ArrowUpRight className="size-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#1E60FF]" />
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug font-medium text-zinc-500">
          {firm.tagline}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <span className="rounded-full border border-zinc-100 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
          {categoryLabel(firm.category)}
        </span>
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-[#1E60FF]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E60FF]"
          >
            {chip}
          </span>
        ))}
      </div>
    </Link>
  );
}
