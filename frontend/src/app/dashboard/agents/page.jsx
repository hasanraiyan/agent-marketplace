"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { searchAgents, deleteAgent } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";

const VISIBILITY_VARIANTS = {
  public: "default",
  unlisted: "secondary",
  private: "outline",
};

export default function MyAgentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-1 h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-8 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No agents yet</EmptyTitle>
                <EmptyDescription>
                  Create your first AI agent to get started.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/dashboard/agents/create">
                  <Button>
                    <Plus data-icon="inline-start" />
                    Create Your First Agent
                  </Button>
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => {
                const agentId = agent.id || agent._id;
                return (
                  <Card key={agentId} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate">
                            {agent.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {agent.description || "No description"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            VISIBILITY_VARIANTS[agent.visibility] || "outline"
                          }
                        >
                          {agent.visibility || "private"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Category
                          </span>
                          <span className="font-medium capitalize">
                            {agent.category || "other"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model</span>
                          <span className="truncate font-medium">
                            {agent.modelName || "default"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created</span>
                          <span>
                            {agent.createdAt
                              ? new Date(agent.createdAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 border-t">
                      <Link
                        href={`/dashboard/agents/${agentId}/run`}
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Play data-icon="inline-start" />
                          Run
                        </Button>
                      </Link>
                      <Link href={`/dashboard/agents/${agentId}/edit`}>
                        <Button variant="outline" size="icon-sm" title="Edit">
                          <Edit />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(agent)}
                      >
                        <Trash2 />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
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
              <span className="font-medium">{deleteTarget?.name}</span>. This
              action cannot be undone.
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
