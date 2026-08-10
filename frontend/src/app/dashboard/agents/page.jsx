"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Bot, SearchIcon, ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { searchAgents, deleteAgent } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";
import { OwnedAgentGrid } from "@/components/agents/owned-agent-grid";

const VISIBILITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
];

export default function MyAgentsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);

  // This page builds its own header (to match Discover) instead of the shared SiteHeader.
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

  const filteredAgents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return agents.filter((a) => {
      const matchesSearch =
        !q ||
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q);
      const matchesVisibility =
        visibility === "all" || a.visibility === visibility;
      return matchesSearch && matchesVisibility;
    });
  }, [agents, search, visibility]);

  const fetchMyAgents = async () => {
    try {
      setLoading(true);
      const profileRes = await getProfile();
      const profile = profileRes.data?.data || profileRes.data;
      const ownerId = profile?.id || profile?._id;

      if (!ownerId) {
        toast.error("Unable to resolve your user profile");
        return;
      }

      const res = await searchAgents({
        ownerId,
        page: 1,
        limit: 100,
        sortBy: "newest",
      });
      setAgents(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load your agents");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchMyAgents();
    }
  }, [isLoaded, isSignedIn]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgent(deleteTarget.id || deleteTarget._id);
      toast.success("Agent deleted");
      setDeleteTarget(null);
      fetchMyAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 flex flex-1 flex-col min-h-full w-full overflow-y-auto no-scrollbar relative">
      <div className="w-full max-w-7xl mx-auto pt-4 pb-24 md:pb-12 px-6 md:px-10 lg:px-12 flex flex-col flex-1">
        {/* Top Bar / Sidebar Trigger & Studio CTA */}
        <div className="flex justify-between items-center mb-2">
          <SidebarTrigger className="-ml-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-150 cursor-pointer transition-colors" />
          <Link href={studioRoutes.home}>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 py-2.5 text-[13px] font-bold transition-all active:scale-98 cursor-pointer shadow-sm shrink-0">
              Agent Studio
            </button>
          </Link>
        </div>

        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4 sm:mt-6 mb-6">
          {isSearchingMobile ? (
            /* Mobile Search View */
            <div className="flex items-center gap-3 w-full md:hidden">
              <button
                onClick={() => {
                  setIsSearchingMobile(false);
                  setSearch("");
                }}
                className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-500 dark:text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search your agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 font-medium"
                />
              </div>
            </div>
          ) : (
            /* Default Header Row */
            <>
              <div className="flex items-center justify-between w-full md:w-auto">
                <div>
                  <h1 className="text-2xl md:text-3xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                    My Agents
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-sm font-medium mt-1.5">
                    Your agents, ready when you need them.
                  </p>
                </div>
                {/* Mobile Search Trigger Button */}
                <button
                  onClick={() => setIsSearchingMobile(true)}
                  className="md:hidden block text-zinc-500 hover:text-zinc-805 dark:text-zinc-400 dark:hover:text-zinc-200 p-2.5 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <SearchIcon className="size-5" />
                </button>
              </div>

              {/* Desktop Search (always visible) */}
              <div className="relative hidden md:block w-[320px]">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-500 dark:text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search your agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 font-medium"
                />
              </div>
            </>
          )}
        </div>

        {/* Visibility Filter Pills */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 mb-6 w-full">
            {VISIBILITY_FILTERS.map((f) => {
              const isActive = visibility === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setVisibility(f.value)}
                  className={`rounded-full px-5 py-2 text-[13px] transition-all whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[300px] sm:h-[360px] rounded-[24px] sm:rounded-[32px]"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
            <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
              <Bot className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
              No agents yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
              You haven&apos;t created any agents yet. Start by creating one now
              to bring your ideas to life!
            </p>
            <Link href={studioRoutes.agentNew} className="mt-6">
              <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
                <Plus className="mr-1.5 size-4" />
                Build Your First Agent
              </Button>
            </Link>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
            <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-650">
              <SearchIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
              No agents match
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
              Try a different search term or filter to see more of your agents.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setVisibility("all");
              }}
              className="mt-6 rounded-full px-6 font-bold transition-all active:scale-98"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <OwnedAgentGrid
            agents={filteredAgents}
            openHref={(id) => `/dashboard/agents/${id}/run`}
            editHref={studioRoutes.agentBuild}
            onDelete={setDeleteTarget}
            primaryLabel="Launch"
          />
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              . This action cannot be undone and all conversation history will
              be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
