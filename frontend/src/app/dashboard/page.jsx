"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  SearchIcon,
  ArrowLeft,
  PlayIcon,
  SparklesIcon,
  ChevronRightIcon,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { HScroller } from "@/components/h-scroller";
import { SkillCover } from "@/components/skills/skill-cover";
import { exploreSkills, listPersonas } from "@/lib/api/skills";
import { studioRoutes } from "@/lib/studio-routes";
import { useOnboardingSection } from "@/hooks/use-onboarding-section";
import { cn } from "@/lib/utils";

// Explore is Spotify-shaped: rows of "songs" (published skills) and
// "artists" (personas). A skill card plays — it drops you straight into the
// creator's persona chat with that skill pinned. A persona card opens the
// creator's profile.

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health-fitness", label: "Health & Fitness" },
  { value: "mind-behavior", label: "Mind & Behavior" },
  { value: "technology", label: "Technology" },
  { value: "life-relationships", label: "Life & Relationships" },
  { value: "careers", label: "Careers" },
];

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "skills", label: "Skills" },
  { value: "personas", label: "Personas" },
];

export function skillPlayHref(skill) {
  const personaId = skill?.persona?._id;
  if (!personaId) return null;
  return `/dashboard/agents/${personaId}/run?skill=${skill._id}&threadId=new`;
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function SkillCard({ skill, onPlay, className }) {
  const playable = Boolean(skill.persona);
  return (
    <button
      type="button"
      onClick={() => playable && onPlay(skill)}
      disabled={!playable}
      className={cn(
        "group flex w-[170px] sm:w-[200px] shrink-0 flex-col text-left select-none rounded-[22px] p-2 -m-2 transition-colors",
        playable
          ? "cursor-pointer hover:bg-zinc-50"
          : "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div className="relative">
        <SkillCover
          skill={skill}
          persona={skill.persona}
          className="aspect-square w-full rounded-[18px] shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
          size="sm"
        />
        {playable ? (
          <span className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-[#1E60FF] text-white shadow-lg shadow-[#1E60FF]/30 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
            <PlayIcon className="size-4 fill-current" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="text-[13px] font-semibold leading-snug text-zinc-900 line-clamp-2">
          {skill.title || skill.name}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
          {skill.persona ? (
            <>
              <img
                src={skill.persona.avatarUrl}
                alt=""
                className="size-4 rounded-full object-cover"
              />
              <span className="truncate">{skill.persona.name}</span>
            </>
          ) : (
            <span>Not playable yet</span>
          )}
        </div>
      </div>
    </button>
  );
}

function PersonaCard({ persona, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(persona)}
      className="group flex w-[150px] sm:w-[170px] shrink-0 flex-col items-center text-center select-none rounded-[22px] p-3 -m-1 transition-colors hover:bg-zinc-50 cursor-pointer"
    >
      <div className="relative size-[126px] sm:size-[146px] overflow-hidden rounded-full bg-zinc-100 shadow-sm ring-1 ring-zinc-100">
        <img
          src={persona.avatarUrl}
          alt={persona.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <h3 className="mt-3 text-[13px] font-semibold leading-snug text-zinc-900 line-clamp-1">
        {persona.name}
      </h3>
      <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
        Persona
        {persona.skillCount
          ? ` · ${persona.skillCount} skill${persona.skillCount === 1 ? "" : "s"}`
          : ""}
      </p>
    </button>
  );
}

function RowHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs font-medium text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function SkillRowSkeleton() {
  return (
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[170px] sm:w-[200px] shrink-0">
          <Skeleton className="aspect-square w-full rounded-[18px]" />
          <Skeleton className="mt-3 h-3.5 w-3/4 rounded" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

function PersonaRowSkeleton() {
  return (
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[150px] sm:w-[170px] shrink-0 flex-col items-center"
        >
          <Skeleton className="size-[126px] sm:size-[146px] rounded-full" />
          <Skeleton className="mt-3 h-3.5 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ children }) {
  return (
    <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm font-medium text-zinc-500">
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  useOnboardingSection("dashboard");

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [category, setCategory] = useState("all");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);
  const debouncedSearch = useDebounced(search);

  const changeSearch = (value) => {
    setSearch(value);
    setSkillsLoading(true);
    setPersonasLoading(true);
  };
  const changeCategory = (value) => {
    setCategory(value);
    setSkillsLoading(true);
  };

  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(true);

  // Hide the default site header for this page only (matches the old explore).
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) header.style.display = "none";
    return () => {
      if (header) header.style.display = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    exploreSkills({
      search: debouncedSearch || undefined,
      category: category === "all" ? undefined : category,
      limit: 60,
    })
      .then((res) => {
        if (!cancelled) setSkills(res.data?.data || []);
      })
      .catch((err) => console.error("Failed to load skills:", err))
      .finally(() => !cancelled && setSkillsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, category]);

  useEffect(() => {
    let cancelled = false;
    listPersonas({ search: debouncedSearch || undefined, limit: 20 })
      .then((res) => {
        if (!cancelled) setPersonas(res.data?.data || []);
      })
      .catch((err) => console.error("Failed to load personas:", err))
      .finally(() => !cancelled && setPersonasLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const requireAuth = useCallback(
    (next) => {
      if (!isSignedIn) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
        return false;
      }
      return true;
    },
    [isSignedIn, router],
  );

  const handlePlay = useCallback(
    (skill) => {
      const href = skillPlayHref(skill);
      if (!href) return;
      if (requireAuth(href)) router.push(href);
    },
    [requireAuth, router],
  );

  const handleOpenPersona = useCallback(
    (persona) => {
      const href = `/dashboard/agents/${persona._id}`;
      if (requireAuth(href)) router.push(href);
    },
    [requireAuth, router],
  );

  const trending = useMemo(() => skills.slice(0, 12), [skills]);
  const isFiltering = Boolean(debouncedSearch) || category !== "all";
  const showSkills = segment !== "personas";
  const showPersonas = segment !== "skills";

  return (
    <div className="bg-white flex flex-1 flex-col min-h-full w-full overflow-y-auto no-scrollbar relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />

      <div className="w-full max-w-7xl mx-auto pt-4 pb-24 md:pb-12 px-6 md:px-10 lg:px-12 flex flex-col flex-1">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-2">
          <div className="md:block hidden">
            <SidebarTrigger className="-ml-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors" />
          </div>
          <div className="md:hidden block text-zinc-800">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18M5 9l14 6M19 9L5 15" />
            </svg>
          </div>
          <button
            onClick={() => router.push(studioRoutes.home)}
            className="bg-[#1E60FF] hover:bg-[#154ed0] text-white rounded-full px-5 py-2.5 text-[13px] font-bold transition-all active:scale-98 cursor-pointer shadow-sm shadow-[#1E60FF]/20 shrink-0"
          >
            Agent Studio
          </button>
        </div>

        {/* Header + search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6 sm:mt-8 mb-6">
          {isSearchingMobile ? (
            <div className="flex items-center gap-3 w-full md:hidden">
              <button
                onClick={() => {
                  setIsSearchingMobile(false);
                  changeSearch("");
                }}
                className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search skills and personas…"
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                  autoFocus
                  className="w-full h-11 rounded-full border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#1E60FF] focus:bg-white transition-colors"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
                  Explore
                </h1>
                <p className="mt-1.5 text-sm font-medium text-zinc-500">
                  Skills are what creators know. Play one and their persona
                  puts it to work for you.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSearchingMobile(true)}
                  className="md:hidden flex size-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 cursor-pointer"
                >
                  <SearchIcon className="size-4.5" />
                </button>
                <div className="relative hidden md:block w-[320px]">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search skills and personas…"
                    value={search}
                    onChange={(e) => changeSearch(e.target.value)}
                    className="w-full h-11 rounded-full border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#1E60FF] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Segments (only meaningful while searching) + categories */}
        <div className="flex flex-col gap-3 mb-8">
          {debouncedSearch ? (
            <div className="inline-flex w-fit items-center rounded-full bg-zinc-100 p-1">
              {SEGMENTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSegment(s.value)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer",
                    segment === s.value
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => changeCategory(c.value)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer border",
                  category === c.value
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 1 — Trending skills */}
        {showSkills ? (
          <section className="mb-12">
            <RowHeader
              title={isFiltering ? "Skills" : "Trending skills"}
              subtitle={
                isFiltering
                  ? `${skills.length} result${skills.length === 1 ? "" : "s"}`
                  : "Most played this week"
              }
            />
            {skillsLoading ? (
              <SkillRowSkeleton />
            ) : skills.length === 0 ? (
              <EmptyRow>
                No skills here yet.{" "}
                <Link
                  href={studioRoutes.skillNew}
                  className="text-[#1E60FF] hover:underline"
                >
                  Publish the first one
                </Link>
                .
              </EmptyRow>
            ) : isFiltering ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-8">
                {skills.map((s) => (
                  <SkillCard
                    key={s._id}
                    skill={s}
                    onPlay={handlePlay}
                    className="w-full sm:w-full"
                  />
                ))}
              </div>
            ) : (
              <HScroller count={trending.length}>
                {trending.map((s) => (
                  <SkillCard key={s._id} skill={s} onPlay={handlePlay} />
                ))}
              </HScroller>
            )}
          </section>
        ) : null}

        {/* Row 2 — Popular personas */}
        {showPersonas ? (
          <section className="mb-12">
            <RowHeader
              title="Popular personas"
              subtitle="The creators behind the skills"
            />
            {personasLoading ? (
              <PersonaRowSkeleton />
            ) : personas.length === 0 ? (
              <EmptyRow>No personas match.</EmptyRow>
            ) : (
              <HScroller count={personas.length}>
                {personas.map((p) => (
                  <PersonaCard
                    key={p._id}
                    persona={p}
                    onOpen={handleOpenPersona}
                  />
                ))}
              </HScroller>
            )}
          </section>
        ) : null}

        {/* Row 3 — Browse all skills (grid) when not filtering */}
        {showSkills && !isFiltering && !skillsLoading && skills.length > 6 ? (
          <section className="mb-12">
            <RowHeader
              title="All skills"
              subtitle={`${skills.length} published`}
              action={
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-zinc-500">
                  <SparklesIcon className="size-3.5 text-[#1E60FF]" />
                  Newest first after trending
                  <ChevronRightIcon className="size-3.5" />
                </span>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-8">
              {skills.map((s) => (
                <SkillCard
                  key={s._id}
                  skill={s}
                  onPlay={handlePlay}
                  className="w-full sm:w-full"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
