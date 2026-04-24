"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit, Play, MessageSquare, Shield, Globe, Lock, Bot, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Card,
} from "@/components/ui/card";
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
      {/* Header */}
      <section className="px-4 lg:px-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              My Agents
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Manage and track the agents you&apos;ve created.
            </p>
          </div>
          <div className="w-full sm:max-w-xs md:max-w-sm">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <SearchIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search your agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-base" // prevents iOS zoom on focus
              />
            </InputGroup>
          </div>
        </div>
      </section>

      <section className="px-4 lg:px-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Empty className="py-20 border-2 border-dashed rounded-2xl">
            <EmptyHeader>
              <EmptyTitle>No agents yet</EmptyTitle>
              <EmptyDescription>
                You haven&apos;t created any agents. Start by creating one now!
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/dashboard/agents/create">
                <Button variant="outline">
                  <Plus data-icon="inline-start" />
                  Create Your First Agent
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : filteredAgents.length === 0 ? (
          <Empty className="py-20 border-2 border-dashed rounded-2xl">
            <EmptyHeader>
              <EmptyTitle>No agents match</EmptyTitle>
              <EmptyDescription>
                Try a different search term or clear the search to see all your agents.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAgents.map((agent) => {
              const agentId = agent.id || agent._id;
              const visibility = VISIBILITY_CONFIG[agent.visibility] || VISIBILITY_CONFIG.private;
              const displayAvatar = agent.avatarUrl || agent.avatar;

              return (
                <Card key={agentId} className="group relative flex flex-col overflow-hidden rounded-xl border-none bg-card ring-1 ring-foreground/10 transition-all hover:shadow-lg hover:ring-primary/20 py-0">
                  {/* Image/Avatar Area */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt={agent.name}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <Bot className="size-10 text-muted-foreground/40" />
                      </div>
                    )}
                    
                    {/* Floating Badges */}
                    <div className="absolute left-2 top-2 z-10 flex gap-1.5">
                      <Badge variant="secondary" className="bg-background/80 text-foreground backdrop-blur-md border-none px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">
                        {agent.category || "other"}
                      </Badge>
                      <Badge variant={visibility.variant} className="backdrop-blur-md border-none px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
                        <visibility.icon className="size-2.5" />
                        {visibility.label}
                      </Badge>
                    </div>

                    {/* Quick Actions Dropdown */}
                    <div className="absolute right-2 top-2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="size-7 bg-background/50 hover:bg-background/80 backdrop-blur-md">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/dashboard/agents/${agentId}/builder`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Edit className="mr-2 size-4" /> Edit Details
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(agent)}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete Agent
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2">
                      <h3 className="line-clamp-1 text-base font-bold transition-colors group-hover:text-primary">
                        {agent.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {agent.description || "No description provided."}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <MessageSquare className="size-3" />
                        <span>{agent.messageCount || 0} chats</span>
                      </div>
                      
                      <Link href={`/dashboard/agents/${agentId}/run`}>
                        <Button size="xs" variant="primary" className="h-7 px-3 text-[10px] font-bold uppercase tracking-tight">
                          <Play className="mr-1 size-2.5 fill-current" />
                          Launch
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
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
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>. This
              action cannot be undone and all conversation history will be lost.
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
