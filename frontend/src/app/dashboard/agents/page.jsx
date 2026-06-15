"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Play,
  MessageSquare,
  Shield,
  Globe,
  Lock,
  Bot,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { searchAgents, deleteAgent } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";
import { MoreVertical } from "lucide-react";
import { useDashboardHeader } from "@/components/dashboard-header-context";

const VISIBILITY_CONFIG = {
  public: { variant: "default", icon: Globe, label: "Public" },
  unlisted: { variant: "secondary", icon: Shield, label: "Unlisted" },
  private: { variant: "outline", icon: Lock, label: "Private" },
};

export default function MyAgentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  useDashboardHeader(
    {
      title: "My Agents",
      description: "Manage and track the agents you've created.",
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
          <Link href="/dashboard/agents/create">
            <Button size="sm" className="rounded-full px-4 font-bold shadow-sm transition-all active:scale-98">
              <Plus className="mr-1.5 size-4" />
              Build an Agent
            </Button>
          </Link>
        </div>
      ),
    },
    [search],
  );

  const filteredAgents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      const name = (a.name || "").toLowerCase();
      const desc = (a.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [agents, search]);

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
    <div className="@container/main flex flex-1 flex-col py-4 md:py-6">
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
          <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
            <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
              <Bot className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
              No agents yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
              You haven&apos;t created any agents yet. Start by creating one now to bring your ideas to life!
            </p>
            <Link href="/dashboard/agents/create" className="mt-6">
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
              Try a different search term or clear the search to see all of your agents.
            </p>
            <Button variant="outline" onClick={() => setSearch("")} className="mt-6 rounded-full px-6 font-bold transition-all active:scale-98">
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAgents.map((agent) => {
              const agentId = agent.id || agent._id;
              const visibility =
                VISIBILITY_CONFIG[agent.visibility] ||
                VISIBILITY_CONFIG.private;
              const displayAvatar = agent.avatarUrl || agent.avatar;

              return (
                <div
                  key={agentId}
                  onClick={() => router.push(`/dashboard/agents/${agentId}/run`)}
                  className="group relative flex flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] h-[300px] sm:h-[360px] bg-zinc-950 border border-zinc-150/10 dark:border-zinc-900/80 transition-all hover:shadow-xl cursor-pointer"
                >
                  {/* Photo Background */}
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={agent.name}
                      className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                      <Bot className="size-16 text-zinc-600" />
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

                  {/* Top Overlay Area (Badges + Actions) */}
                  <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Badge
                        variant="secondary"
                        className="bg-black/40 text-white backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold"
                      >
                        {agent.category || "other"}
                      </Badge>
                      <Badge
                        variant={visibility.variant}
                        className="bg-black/40 text-white backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1"
                      >
                        <visibility.icon className="size-2.5" />
                        {visibility.label}
                      </Badge>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 rounded-full bg-black/40 hover:bg-black/60 text-white hover:text-white aria-expanded:bg-black/60 aria-expanded:text-white border border-white/10 backdrop-blur-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl shadow-md border-zinc-150/80 dark:border-zinc-850">
                        <Link href={`/dashboard/agents/${agentId}/builder`}>
                          <DropdownMenuItem className="cursor-pointer font-semibold text-xs py-2" onClick={(e) => e.stopPropagation()}>
                            <Edit className="mr-2 size-3.5 text-zinc-500" /> Edit Details
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive font-semibold text-xs py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(agent);
                          }}
                        >
                          <Trash2 className="mr-2 size-3.5" /> Delete Agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Bottom Content Area */}
                  <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-5 right-4 sm:right-5 z-20 flex flex-col justify-end text-white select-none">
                    <h3 className="line-clamp-1 text-base sm:text-lg font-bold tracking-tight leading-snug">
                      {agent.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[11px] sm:text-xs text-white/70 leading-relaxed font-medium">
                      {agent.description || "No description provided."}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/50 uppercase tracking-tight">
                        <MessageSquare className="size-3.5" />
                        <span>{agent.messageCount || 0} chats</span>
                      </div>

                      <Link href={`/dashboard/agents/${agentId}/run`} onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="xs"
                          className="h-7 px-3.5 text-[10px] font-bold uppercase tracking-tight rounded-full bg-white hover:bg-white/90 text-zinc-900 border-none shadow-sm active:scale-95 transition-all"
                        >
                          <Play className="mr-1 size-2.5 fill-current" />
                          Launch
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
