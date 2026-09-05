"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  SearchIcon,
  BotIcon,
  CompassIcon,
  MessageSquareIcon,
  PlusIcon,
  UserIcon,
  MoreHorizontalIcon,
  ArrowLeft,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TiltCard } from "@/components/ui/tilt-card";
import { Skeleton } from "@/components/ui/skeleton";
import { HScroller } from "@/components/h-scroller";
import { searchAgents } from "@/lib/api/agents";
import { studioRoutes } from "@/lib/studio-routes";
import { useOnboardingSection } from "@/hooks/use-onboarding-section";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health-fitness", label: "Health & Fitness" },
  { value: "mind-behavior", label: "Mind & Behavior" },
  { value: "technology", label: "Technology" },
  { value: "life-relationships", label: "Life & Relationships" },
  { value: "library-minds", label: "The Library of Minds" },
  { value: "careers", label: "Careers" },
];

const DB_CATEGORY_MAP = {
  entrepreneurship: "productivity",
  "health-fitness": "research",
  "mind-behavior": "research",
  technology: "coding",
  "life-relationships": "roleplay",
  "library-minds": "research",
  careers: "productivity",
  all: "other",
};

export default function ExplorePage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  useOnboardingSection("dashboard");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);

  const activeCategoryLabel = useMemo(() => {
    return CATEGORIES.find((c) => c.value === category)?.label || "";
  }, [category]);

  const [dbAgents, setDbAgents] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Hide the default site header for this page only
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) {
      header.style.display = "none";
    }
    return () => {
      if (header) {
        header.style.display = "";
      }
    };
  }, []);

  // Fetch db agents
  useEffect(() => {
    const loadDbAgents = async () => {
      try {
        const res = await searchAgents({ page: 1, limit: 30 });
        setDbAgents(res.data?.data || []);
      } catch (err) {
        console.error("Failed to load DB agents:", err);
      } finally {
        setDbLoading(false);
      }
    };
    loadDbAgents();
  }, []);

  // Helper to extract a sample prompt for a mind
  const getSamplePrompt = (mindName, mindCategory) => {
    // Dynamic by category
    const cat = mindCategory || "";
    if (cat === "productivity") {
      return "How can I optimize my workflow today?";
    }
    if (cat === "coding") {
      return "Can you help me write or debug some code?";
    }
    if (cat === "creative") {
      return "Can you help me brainstorm some creative ideas?";
    }
    if (cat === "research") {
      return "What are some key research points on this topic?";
    }
    if (cat === "roleplay") {
      return "Let's start an interactive roleplay session.";
    }
    return "How can you help me today?";
  };

  // Dynamic Featured Minds from database actual agents
  const featuredList = useMemo(() => {
    const mapped = dbAgents.map((agent) => ({
      id: agent._id || agent.id,
      _id: agent._id || agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      avatarUrl: agent.avatarUrl || agent.avatar,
      verified: (agent.messageCount || 0) > 5,
      isFeatured: true,
      mindCount: `${agent.messageCount || 0} Chats`,
      chatPrompt: getSamplePrompt(agent.name, agent.category),
    }));

    // Filter by search & category
    return mapped.filter((mind) => {
      const matchesSearch =
        mind.name.toLowerCase().includes(search.toLowerCase()) ||
        mind.description.toLowerCase().includes(search.toLowerCase());

      let matchesCategory = category === "all";
      if (!matchesCategory) {
        matchesCategory = mind.category === DB_CATEGORY_MAP[category];
      }

      return matchesSearch && matchesCategory;
    });
  }, [dbAgents, search, category]);

  // Dynamic Trending Minds from database actual agents
  const trendingList = useMemo(() => {
    const mapped = dbAgents.map((agent) => ({
      id: agent._id || agent.id,
      _id: agent._id || agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      avatarUrl: agent.avatarUrl || agent.avatar,
      verified: (agent.messageCount || 0) > 5,
      messageCount: agent.messageCount || 0,
      mindCount: `${agent.messageCount || 0} Chats`,
      chatPrompt: getSamplePrompt(agent.name, agent.category),
    }));

    // Sort by message count descending
    const sorted = mapped.sort((a, b) => b.messageCount - a.messageCount);

    // Filter by search & category
    const filtered = sorted.filter((mind) => {
      const matchesSearch =
        mind.name.toLowerCase().includes(search.toLowerCase()) ||
        mind.description.toLowerCase().includes(search.toLowerCase());

      let matchesCategory = category === "all";
      if (!matchesCategory) {
        matchesCategory = mind.category === DB_CATEGORY_MAP[category];
      }

      return matchesSearch && matchesCategory;
    });

    // Return list with calculated ranking index
    return filtered.map((mind, idx) => ({
      ...mind,
      rank: idx + 1,
    }));
  }, [dbAgents, search, category]);

  const handleMindClick = async (mind) => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/dashboard`);
      return;
    }

    const agentId = mind._id || mind.id;
    if (agentId) {
      router.push(`/dashboard/agents/${agentId}/run`);
    }
  };

  return (
    <div className="bg-white flex flex-1 flex-col min-h-full w-full overflow-y-auto no-scrollbar relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
        }}
      />

      <div className="w-full max-w-7xl mx-auto pt-4 pb-24 md:pb-12 px-6 md:px-10 lg:px-12 flex flex-col flex-1">
        {/* Top Bar / Sidebar Trigger & Create Button */}
        <div className="flex justify-between items-center mb-2">
          <div className="md:block hidden">
            <SidebarTrigger className="-ml-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors" />
          </div>
          <div className="md:hidden block">
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
          {/* Creator entry point: crossing into the build experience, not
            opening a single form. */}
          <button
            onClick={() => router.push(studioRoutes.home)}
            className="bg-[#1E60FF] hover:bg-[#154ed0] text-white rounded-full px-5 py-2.5 text-[13px] font-bold transition-all active:scale-98 cursor-pointer shadow-sm shadow-[#1E60FF]/20 shrink-0"
          >
            Agent Studio
          </button>
        </div>

        {/* Main Discover Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6 sm:mt-8 mb-6">
          {isSearchingMobile ? (
            /* Mobile Search View */
            <div className="flex items-center gap-3 w-full md:hidden">
              <button
                onClick={() => {
                  setIsSearchingMobile(false);
                  setSearch("");
                }}
                className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search minds..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border border-zinc-200 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-[#1E60FF]/20 focus:border-[#1E60FF] transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                />
              </div>
            </div>
          ) : (
            /* Default Discover Header Row */
            <>
              <div className="flex items-start justify-between w-full md:w-auto">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase mb-2">
                    An index of minds
                  </p>
                  {category === "all" ? (
                    <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.1]">
                      Who do you want to talk to?
                    </h1>
                  ) : (
                    <h1 className="font-display text-2xl md:text-4xl tracking-tight leading-[1.1]">
                      <span
                        onClick={() => setCategory("all")}
                        className="text-zinc-400 font-normal hover:text-zinc-600 cursor-pointer transition-colors"
                      >
                        Discover
                      </span>
                      <span className="text-zinc-300 font-normal"> / </span>
                      <span className="font-semibold text-zinc-900">
                        {activeCategoryLabel}
                      </span>
                    </h1>
                  )}
                  <p className="text-zinc-500 text-sm md:text-base font-medium mt-2">
                    Talk to trusted minds with real experience.
                  </p>
                </div>
                {/* Mobile Search Trigger Button */}
                <button
                  onClick={() => setIsSearchingMobile(true)}
                  className="md:hidden block text-zinc-500 hover:text-zinc-800 p-2.5 rounded-full hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <SearchIcon className="size-5" />
                </button>
              </div>

              {/* Desktop Search (always visible) */}
              <div className="relative hidden md:block w-[320px] shrink-0">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search minds..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border border-zinc-200 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-[#1E60FF]/20 focus:border-[#1E60FF] transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                />
              </div>
            </>
          )}
        </div>

        {/* Category Selection Pills */}
        <div className="mb-10 w-full">
          <HScroller count={CATEGORIES.length}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-full px-5 py-2 text-[13px] transition-all whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? "bg-[#1E60FF] text-white font-bold shadow-sm shadow-[#1E60FF]/20"
                      : "bg-zinc-100/80 hover:bg-zinc-200/80 text-zinc-500 hover:text-zinc-900 font-medium"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </HScroller>
        </div>

        {/* Loading skeleton — mirrors the real Featured/Trending layout
            instead of a bare spinner, so the page doesn't jump/reflow once
            data arrives. */}
        {dbLoading && (
          <>
            <div className="mb-12">
              <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase mb-4">
                Featured
              </p>
              <div className="flex gap-5 overflow-x-hidden py-2 px-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    className="w-[190px] sm:w-[230px] h-[255px] sm:h-[310px] shrink-0 rounded-[24px] sm:rounded-[32px]"
                  />
                ))}
              </div>
            </div>

            <div className="w-full">
              <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase mb-2">
                Trending
              </p>
              <div className="flex flex-col gap-1 w-full">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-4 px-4 -mx-4 gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-14 shrink-0 rounded-full" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-48 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="hidden h-12 w-64 rounded-2xl sm:block" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Featured Minds Slider */}
        {!dbLoading && featuredList.length > 0 && (
          <div className="mb-12">
            <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase mb-4">
              Featured
            </p>
            <HScroller count={featuredList.length}>
              {featuredList.map((mind) => (
                <TiltCard
                  key={mind.id}
                  onClick={() => handleMindClick(mind)}
                  className="w-[190px] sm:w-[230px] h-[255px] sm:h-[310px] shrink-0 relative rounded-[24px] sm:rounded-[32px] overflow-hidden group cursor-pointer"
                >
                  {/* Photo */}
                  <img
                    src={mind.avatarUrl}
                    alt={mind.name}
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />

                  {/* Name + description — fades out on hover */}
                  <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex flex-col justify-end text-white select-none transition-opacity duration-300 group-hover:opacity-0">
                    <h3 className="font-display text-lg sm:text-2xl font-semibold tracking-tight leading-none">
                      {mind.name}
                    </h3>
                    <p className="text-white/80 text-[11px] sm:text-[13px] font-medium leading-snug line-clamp-2 mt-1.5">
                      {mind.description}
                    </p>
                  </div>

                  {/* Sample-prompt reveal — a preview of an actual conversation,
                      not just a profile blurb */}
                  <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex items-start gap-1.5 rounded-2xl rounded-bl-none bg-white/95 px-3.5 py-3 backdrop-blur-sm">
                      <MessageSquareIcon className="size-3.5 shrink-0 text-[#1E60FF] mt-0.5" />
                      <p className="text-[11px] sm:text-xs font-semibold leading-snug text-zinc-800 line-clamp-3">
                        {mind.chatPrompt}
                      </p>
                    </div>
                  </div>
                </TiltCard>
              ))}
            </HScroller>
          </div>
        )}

        {/* Trending Minds Vertical List */}
        {!dbLoading && trendingList.length > 0 && (
          <div className="w-full">
            <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase mb-2">
              Trending
            </p>
            <div className="flex flex-col gap-1 w-full">
              {trendingList.map((mind) => (
                <div
                  key={mind.id}
                  onClick={() => handleMindClick(mind)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-4 -mx-4 rounded-2xl hover:bg-zinc-50 border-b border-zinc-100 gap-4 cursor-pointer group transition-colors duration-200"
                >
                  {/* Left Info: Avatar + Details */}
                  <div className="flex items-center gap-4 select-none">
                    {/* Avatar with rank overlay */}
                    <div className="relative">
                      <img
                        src={mind.avatarUrl}
                        alt={mind.name}
                        className="size-14 rounded-full object-cover border border-zinc-150 transition-transform group-hover:scale-102"
                      />
                      <div className="absolute -bottom-1 -left-1 bg-white border border-zinc-200 text-zinc-800 text-[10px] font-black size-5.5 rounded-full flex items-center justify-center shadow-sm">
                        {mind.rank}
                      </div>
                    </div>

                    {/* Details */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-base font-semibold text-zinc-900">
                          {mind.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-bold ml-2">
                          {mind.mindCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-400 mt-0.5 line-clamp-1 max-w-xs sm:max-w-md">
                        {mind.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Speech Bubble */}
                  <div className="bg-zinc-50 text-zinc-700 px-6 py-3.5 rounded-2xl rounded-tr-none border border-zinc-100 max-w-full sm:max-w-lg flex items-center text-sm font-semibold select-none sm:mr-2 group-hover:border-[#1E60FF]/20 transition-colors">
                    {mind.chatPrompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State when no results found */}
        {!dbLoading &&
          featuredList.length === 0 &&
          trendingList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <div className="size-16 rounded-full bg-[#1E60FF]/5 border border-[#1E60FF]/10 flex items-center justify-center mb-4 text-[#1E60FF]">
                <BotIcon className="size-8" />
              </div>
              <h3 className="font-display text-lg font-semibold text-zinc-900">
                No minds found
              </h3>
              <p className="text-sm text-zinc-400 mt-1 max-w-xs">
                Try adjusting your search query or select another category.
              </p>
            </div>
          )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-zinc-150/80 px-6 py-3 flex items-center justify-around md:hidden backdrop-blur-md shadow-lg">
        {/* Discover (Active) */}
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className="bg-[#1E60FF]/10 text-[#1E60FF] rounded-full p-2.5">
            <CompassIcon className="size-5.5" />
          </div>
        </Link>

        {/* Chats / My Agents */}
        <Link
          href="/dashboard/agents"
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-900"
        >
          <div className="p-2.5">
            <MessageSquareIcon className="size-5.5" />
          </div>
        </Link>

        {/* Plus / Create */}
        <Link
          href={studioRoutes.agentNew}
          className="flex items-center justify-center"
        >
          <div className="border border-zinc-200 bg-white text-zinc-850 rounded-full p-2.5 hover:bg-zinc-50 shadow-sm transition-colors active:scale-95">
            <PlusIcon className="size-5.5" />
          </div>
        </Link>

        {/* Profile */}
        <Link
          href="/dashboard/settings/profile"
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-900"
        >
          <div className="p-2.5">
            <UserIcon className="size-5.5" />
          </div>
        </Link>

        {/* More / Settings */}
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
