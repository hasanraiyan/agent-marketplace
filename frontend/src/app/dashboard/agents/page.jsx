"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchIcon, ArrowLeft, CompassIcon, MessageSquare } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { getActiveAgents } from "@/lib/api/threads";
import { getProfile } from "@/lib/api/profile";
import { OwnedAgentGrid } from "@/components/agents/owned-agent-grid";

// "My Agents" = the agents you actually use: every persona you have a
// conversation with, most recent first. Agents you *build* live in Studio.

export default function MyAgentsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(null);
  const [search, setSearch] = useState("");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);

  // This page builds its own header (to match Explore) instead of the shared SiteHeader.
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) header.style.display = "none";
    return () => {
      if (header) header.style.display = "";
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    Promise.all([getActiveAgents(), getProfile()])
      .then(([activeRes, profileRes]) => {
        if (cancelled) return;
        setItems(activeRes.data?.data || []);
        const p = profileRes.data?.data || profileRes.data;
        setProfileId(p?.id || p?._id || null);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Failed to load your agents");
        setItems([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.agent.name || "").toLowerCase().includes(q) ||
        (it.agent.tagline || it.agent.description || "")
          .toLowerCase()
          .includes(q),
    );
  }, [items, search]);

  return (
    <div className="bg-white flex flex-1 flex-col min-h-full w-full overflow-y-auto no-scrollbar relative">
      <div className="w-full max-w-7xl mx-auto pt-4 pb-24 md:pb-12 px-6 md:px-10 lg:px-12 flex flex-col flex-1">
        {/* Top Bar / Sidebar Trigger & Studio CTA */}
        <div className="flex justify-between items-center mb-2">
          <SidebarTrigger className="-ml-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors" />
          <Link href={studioRoutes.home}>
            <button className="bg-[#1E60FF] hover:bg-[#154ed0] text-white rounded-full px-5 py-2.5 text-[13px] font-bold transition-all active:scale-98 cursor-pointer shadow-sm shadow-[#1E60FF]/20 shrink-0">
              Agent Studio
            </button>
          </Link>
        </div>

        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6 sm:mt-8 mb-8">
          {isSearchingMobile ? (
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
                  placeholder="Search your agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border border-zinc-200 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-[#1E60FF]/20 focus:border-[#1E60FF] transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between w-full md:w-auto">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase mb-2">
                    In use
                  </p>
                  <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.1]">
                    My Agents
                  </h1>
                  <p className="text-zinc-500 text-sm md:text-base font-medium mt-2">
                    The personas you&apos;re working with, most recent first.
                    Agents you build live in Studio.
                  </p>
                </div>
                <button
                  onClick={() => setIsSearchingMobile(true)}
                  className="md:hidden block text-zinc-500 hover:text-zinc-800 p-2.5 rounded-full hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <SearchIcon className="size-5" />
                </button>
              </div>
              <div className="relative hidden md:block w-[320px] shrink-0">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search your agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border border-zinc-200 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-[#1E60FF]/20 focus:border-[#1E60FF] transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                />
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[300px] sm:h-[360px] rounded-[24px] sm:rounded-[32px]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center select-none max-w-md mx-auto mt-4">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase mb-3">
              In use
            </span>
            <h3 className="font-display text-2xl font-semibold text-zinc-900">
              {search ? "No matches." : "Nothing in use yet."}
            </h3>
            <p className="text-sm text-zinc-500 mt-2.5 max-w-sm leading-relaxed">
              {search
                ? "Try a different name."
                : "Play a skill or start a chat with a persona on Explore and it shows up here."}
            </p>
            {!search ? (
              <Link href="/dashboard" className="mt-7">
                <Button className="h-11 gap-2 rounded-full bg-[#1E60FF] px-6 text-sm font-semibold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:scale-[1.02] hover:bg-[#154ed0] active:scale-[0.98]">
                  <CompassIcon className="size-4" />
                  Explore
                </Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <OwnedAgentGrid
            agents={filtered.map((it) => ({
              ...it.agent,
              messageCount: it.threadCount,
            }))}
            openHref={(id) => `/dashboard/agents/${id}/run?threadId=new`}
            editHref={(id) => studioRoutes.agentBuild(id)}
            onDelete={(agent) => router.push(studioRoutes.agent(agent._id || agent.id))}
            canManage={(agent) =>
              Boolean(profileId && String(agent.ownerId) === String(profileId))
            }
            primaryLabel="Chat"
            primaryIcon={MessageSquare}
            primaryIconClassName=""
            editLabel="Manage in Studio"
          />
        )}
      </div>
    </div>
  );
}
