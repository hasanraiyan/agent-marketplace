"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Bot,
  Users,
  Star,
  Calendar,
  Eye,
  Loader2,
  Globe,
  Lock,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { getAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";

const VISIBILITY_ICONS = {
  public: Globe,
  unlisted: EyeOff,
  private: Lock,
};

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const { isLoaded, isSignedIn } = useAuth();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAgent(agentId);
        setAgent(res.data?.data || null);
      } catch (err) {
        if (err.response?.status === 404) {
          setAgent(null);
        } else {
          toast.error(err.response?.data?.message || "Failed to load agent");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agentId]);

  const handleUseAgent = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/agents/${agentId}`);
      return;
    }
    setStarting(true);
    try {
      const res = await createThread({ agentId });
      const thread = res.data?.data;
      const tid = thread?.id || thread?._id;
      if (tid) {
        router.push(`/dashboard/agents/${agentId}/run`);
      } else {
        router.push(`/dashboard/agents/${agentId}/run`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start chat");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-32" />
          <div className="mt-6 flex items-start gap-6">
            <Skeleton className="size-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/agents"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Agent not found</EmptyTitle>
              <EmptyDescription>
                This agent may have been removed or is no longer public.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const VisibilityIcon = VISIBILITY_ICONS[agent.visibility] || Globe;
  const rating = Math.min(5, Math.max(0, agent.rating || 0));
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard/agents"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar className="size-24 shrink-0">
              <AvatarImage src={agent.avatarUrl || agent.avatar} alt={agent.name} />
              <AvatarFallback>
                <Bot className="size-10" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {agent.category || "other"}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  <VisibilityIcon data-icon="inline-start" />
                  {agent.visibility || "public"}
                </Badge>
                {!agent.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {agent.name}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {agent.description || "No description provided."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {stars.map((filled, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${
                          filled
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                  <span>({agent.reviewCount || 0} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="size-4" />
                  <span>{agent.usageCount || 0} uses</span>
                </div>
                {agent.createdAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    <span>
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:shrink-0">
              <Button
                size="lg"
                onClick={handleUseAgent}
                disabled={starting || !agent.isActive || !isLoaded}
              >
                {starting ? (
                  <>
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play data-icon="inline-start" />
                    Use Agent
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {agent.tags && agent.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>About this agent</CardTitle>
                <CardDescription>
                  What this agent does and how it behaves.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {agent.description || "No description provided."}
                </p>
              </CardContent>
            </Card>

            {agent.systemPrompt && (
              <Card>
                <CardHeader>
                  <CardTitle>System Prompt</CardTitle>
                  <CardDescription>
                    The instructions that shape this agent&apos;s behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {agent.systemPrompt}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
                <CardDescription>
                  What other users are saying about this agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No reviews yet</EmptyTitle>
                    <EmptyDescription>
                      Be the first to try this agent and share your experience.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-medium">
                      {agent.modelName || "Default"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Web Search</span>
                    <span className="font-medium">
                      {agent.webSearchEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium capitalize">
                      {agent.category || "other"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <span className="font-medium capitalize">
                      {agent.visibility || "public"}
                    </span>
                  </div>
                  {agent.updatedAt && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Updated</span>
                        <span className="font-medium">
                          {new Date(agent.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {!isLoaded ? (
              <Skeleton className="h-12 w-full" />
            ) : !isSignedIn ? (
              <Card>
                <CardHeader>
                  <CardTitle>Sign in to use</CardTitle>
                  <CardDescription>
                    Create an account to chat with this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/sign-in?redirect_url=/agents/${agentId}`}
                    className="block"
                  >
                    <Button className="w-full">Sign In</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
