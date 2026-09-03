"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SearchIcon,
  Building2Icon,
  CompassIcon,
  BriefcaseIcon,
  PlusIcon,
  UserIcon,
  MoreHorizontalIcon,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { HScroller } from "@/components/h-scroller";
import { listFirms } from "@/lib/api/firms";
import { personaRoutes } from "@/lib/studio-routes";
import { useOnboardingSection } from "@/hooks/use-onboarding-section";
import {
  FirmCard,
  FirmFeaturedCard,
  FIRM_CATEGORIES,
  apiError,
} from "@/components/firms";

const STUDIO_FIRM_URL = "/studio/firm";

export default function ExplorePage() {
  const router = useRouter();
  useOnboardingSection("dashboard");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeCategoryLabel = useMemo(
    () => FIRM_CATEGORIES.find((c) => c.value === category)?.label || "",
    [category],
  );

  // Hide the default site header for this page only
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) header.style.display = "none";
    return () => {
      if (header) header.style.display = "";
    };
  }, []);

  // Debounce the problem box before it hits the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page: 1, limit: 40 };
        if (debouncedSearch) params.search = debouncedSearch;
        if (category !== "all") params.category = category;
        const res = await listFirms(params);
        if (!cancelled) setFirms(res.data?.data || []);
      } catch (err) {
        if (!cancelled) {
          setFirms([]);
          toast.error(apiError(err, "Failed to load firms"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, category]);

  const featured = useMemo(
    () =>
      [...firms]
        .sort((a, b) => (b.projectCount || 0) - (a.projectCount || 0))
        .slice(0, 8),
    [firms],
  );

  const openFirm = (firm) => router.push(personaRoutes.firm(firm.slug));

  const searchInput = (autoFocus = false) => (
    <div className="relative w-full">
      <SearchIcon className="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        placeholder="Describe your problem… e.g. “I need a landing page that converts”"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus={autoFocus}
        className="w-full rounded-full border border-zinc-200 bg-white py-3.5 pr-5 pl-13 text-[15px] font-medium text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-all outline-none placeholder:text-zinc-400 focus:border-[#1E60FF] focus:ring-4 focus:ring-[#1E60FF]/10"
      />
    </div>
  );

  return (
    <div className="no-scrollbar relative flex min-h-full w-full flex-1 flex-col overflow-y-auto bg-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pt-4 pb-24 md:px-10 md:pb-12 lg:px-12">
        {/* Top bar */}
        <div className="mb-2 flex items-center justify-between">
          <div className="hidden md:block">
            <SidebarTrigger className="-ml-2 h-9 w-9 cursor-pointer text-zinc-500 transition-colors hover:text-zinc-900" />
          </div>
          <div className="block md:hidden">
            <div className="text-zinc-800">
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
          </div>
          <button
            onClick={() => router.push(STUDIO_FIRM_URL)}
            className="shrink-0 cursor-pointer rounded-full bg-[#1E60FF] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98"
          >
            Build your firm
          </button>
        </div>

        {/* Hero */}
        <div className="mt-6 mb-6 sm:mt-10">
          {isSearchingMobile ? (
            <div className="flex w-full items-center gap-3 md:hidden">
              <button
                onClick={() => {
                  setIsSearchingMobile(false);
                  setSearch("");
                }}
                className="cursor-pointer text-zinc-500 hover:text-zinc-800"
              >
                <ArrowLeft className="size-5" />
              </button>
              {searchInput(true)}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
                  Humans &amp; Harness
                </p>
                {category === "all" ? (
                  <h1 className="font-display text-3xl leading-[1.05] font-semibold tracking-tight text-zinc-900 md:text-5xl">
                    Find the firm for your problem
                  </h1>
                ) : (
                  <h1 className="font-display text-3xl leading-[1.05] tracking-tight md:text-5xl">
                    <span
                      onClick={() => setCategory("all")}
                      className="cursor-pointer font-normal text-zinc-400 transition-colors hover:text-zinc-600"
                    >
                      Firms
                    </span>
                    <span className="font-normal text-zinc-300"> / </span>
                    <span className="font-semibold text-zinc-900">
                      {activeCategoryLabel}
                    </span>
                  </h1>
                )}
                <p className="mt-3 text-sm font-medium text-zinc-500 md:text-base">
                  One-person companies that sell outcomes, not hours. Pick a
                  project, and their team gets to work.
                </p>
              </div>
              <button
                onClick={() => setIsSearchingMobile(true)}
                className="block cursor-pointer rounded-full p-2.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 md:hidden"
              >
                <SearchIcon className="size-5" />
              </button>
            </div>
          )}

          {!isSearchingMobile && (
            <div className="mt-6 hidden max-w-2xl md:block">{searchInput()}</div>
          )}
        </div>

        {/* Category chips */}
        <div className="mb-10 w-full">
          <HScroller count={FIRM_CATEGORIES.length}>
            {FIRM_CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`cursor-pointer rounded-full px-5 py-2 text-[13px] whitespace-nowrap transition-all select-none ${
                    isActive
                      ? "bg-[#1E60FF] font-bold text-white shadow-sm shadow-[#1E60FF]/20"
                      : "bg-zinc-100/80 font-medium text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </HScroller>
        </div>

        {/* Skeletons */}
        {loading && (
          <>
            <div className="mb-12">
              <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
                Featured firms
              </p>
              <div className="flex gap-5 overflow-x-hidden px-0.5 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-[255px] w-[190px] shrink-0 rounded-[24px] sm:h-[310px] sm:w-[230px] sm:rounded-[32px]"
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
                All firms
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-[196px] rounded-[24px]" />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Featured */}
        {!loading && featured.length > 0 && (
          <div className="mb-12">
            <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
              Featured firms
            </p>
            <HScroller count={featured.length}>
              {featured.map((firm) => (
                <FirmFeaturedCard
                  key={firm._id || firm.slug}
                  firm={firm}
                  onClick={() => openFirm(firm)}
                />
              ))}
            </HScroller>
          </div>
        )}

        {/* All firms */}
        {!loading && firms.length > 0 && (
          <div className="w-full">
            <div className="mb-4 flex items-end justify-between">
              <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
                All firms
              </p>
              <span className="text-[11px] font-semibold text-zinc-400">
                {firms.length} {firms.length === 1 ? "firm" : "firms"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {firms.map((firm, i) => (
                <motion.div
                  key={firm._id || firm.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 9) * 0.04 }}
                >
                  <FirmCard firm={firm} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && firms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center select-none">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-[#1E60FF]/10 bg-[#1E60FF]/5 text-[#1E60FF]">
              <Building2Icon className="size-8" />
            </div>
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              {debouncedSearch || category !== "all"
                ? "No firms match that yet"
                : "No firms have opened their doors yet"}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">
              {debouncedSearch || category !== "all"
                ? "Try describing the problem differently or browse another category."
                : "Be the first: turn your expertise into a firm that sells outcomes."}
            </p>
            {(debouncedSearch || category !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="mt-5 cursor-pointer rounded-full border border-zinc-200 px-4 py-2 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Clear filters
              </button>
            )}
            {!debouncedSearch && category === "all" && (
              <Link
                href={STUDIO_FIRM_URL}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#1E60FF] px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0]"
              >
                Build your firm
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <div className="fixed right-0 bottom-0 left-0 z-40 flex items-center justify-around border-t border-zinc-150/80 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-md md:hidden">
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className="rounded-full bg-[#1E60FF]/10 p-2.5 text-[#1E60FF]">
            <CompassIcon className="size-5.5" />
          </div>
        </Link>
        <Link
          href={personaRoutes.projects}
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-900"
        >
          <div className="p-2.5">
            <BriefcaseIcon className="size-5.5" />
          </div>
        </Link>
        <Link href={STUDIO_FIRM_URL} className="flex items-center justify-center">
          <div className="rounded-full border border-zinc-200 bg-white p-2.5 text-zinc-850 shadow-sm transition-colors hover:bg-zinc-50 active:scale-95">
            <PlusIcon className="size-5.5" />
          </div>
        </Link>
        <Link
          href="/dashboard/settings/profile"
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-900"
        >
          <div className="p-2.5">
            <UserIcon className="size-5.5" />
          </div>
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-900"
        >
          <div className="p-2.5">
            <MoreHorizontalIcon className="size-5.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
