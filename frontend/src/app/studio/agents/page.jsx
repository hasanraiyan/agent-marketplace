"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { BotIcon, PlusIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { OwnedAgentGrid } from "@/components/agents/owned-agent-grid";
import { searchAgents, deleteAgent } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";
import { useDashboardHeader } from "@/components/dashboard-header-context";

/**
 * Studio agent management — the agents this creator owns.
 *
 * Same data and same cards as the dashboard "My Agents" list, but the primary
 * action opens the agent's creator workspace instead of a chat.
 */
export default function StudioAgentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useDashboardHeader(
    {
      title: "Agents",
      description: "Agents you own — build, test, and publish them here.",
      actions: (
        <div className="flex items-center gap-2">
          <div className="hidden w-72 md:block">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <SearchIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search your agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-base"
              />
            </InputGroup>
          </div>
          <Link href="/studio/agents/new">
            <Button size="sm" className="rounded-full px-4 font-bold">
              <PlusIcon className="mr-1.5 size-4" />
              New Agent
            </Button>
          </Link>
        </div>
      ),
    },
    [search],
  );

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
    if (isLoaded && isSignedIn) fetchMyAgents();
  }, [isLoaded, isSignedIn]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    );
  }, [agents, search]);

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
    <div className="@container/main flex min-h-0 flex-1 flex-col overflow-y-auto py-4 md:py-6">
      <section className="mb-4 px-4 md:hidden lg:px-6">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search your agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-base"
          />
        </InputGroup>
      </section>

      <section className="px-4 lg:px-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center justify-center rounded-[28px] border border-slate-150/70 bg-slate-50/50 px-6 py-20 text-center select-none dark:border-slate-850/60 dark:bg-slate-950/20">
            <div className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
              <BotIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              No agents yet
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
              Studio is where you build them. Describe what you want to Sage, or
              configure everything by hand.
            </p>
            <Link href="/studio/agents/new" className="mt-6">
              <Button className="rounded-full px-6 py-2.5 font-bold">
                <PlusIcon className="mr-1.5 size-4" />
                Build your first agent
              </Button>
            </Link>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center justify-center rounded-[28px] border border-slate-150/70 bg-slate-50/50 px-6 py-20 text-center select-none dark:border-slate-850/60 dark:bg-slate-950/20">
            <div className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
              <SearchIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              No agents match
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
              Try a different search term or clear the search to see all of your
              agents.
            </p>
            <Button
              variant="outline"
              onClick={() => setSearch("")}
              className="mt-6 rounded-full px-6 font-bold"
            >
              Clear search
            </Button>
          </div>
        ) : (
          <OwnedAgentGrid
            agents={filteredAgents}
            openHref={(id) => `/studio/agents/${id}`}
            editHref={(id) => `/studio/agents/${id}/build`}
            onDelete={setDeleteTarget}
            primaryLabel="Manage"
            primaryIcon={SettingsIcon}
            primaryIconClassName=""
            editLabel="Open builder"
          />
        )}
      </section>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="text-foreground font-medium">
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
