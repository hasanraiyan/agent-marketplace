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
  Globe,
  Lock,
  EyeOff,
  BookText,
  Search,
  Wrench,
  Share2,
  MessageSquare,
  Sparkles,
  BadgeCheck,
  SlidersHorizontal,
  UserRound,
  Link2,
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
import { getProfile } from "@/lib/api/profile";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { studioRoutes } from "@/lib/studio-routes";

const VISIBILITY_ICONS = {
  public: Globe,
  unlisted: EyeOff,
  private: Lock,
};

/**
 * Consumer-facing agent profile.
 *
 * This page answers "what is this agent and should I use it?" — nothing more.
 * Builder internals (system prompt, provider/model wiring, MCP configuration,
 * raw memory files, skill implementation details) intentionally do NOT appear
 * here; they live in the owner's workspace at /studio/agents/:id.
 *
 * Capabilities are described in plain language derived from fields the API
 * already returns, so a visitor never needs to know what MCP or RAG mean.
 */
function capabilitySummary(agent) {
  const capabilities = [];

  if (agent.webSearchEnabled) {
    capabilities.push({
      icon: Search,
      title: "Searches the web",
      description: "Can look things up online while you chat.",
    });
  }

  const knowledgeCount = (agent.knowledgeBases || []).length;
  if (knowledgeCount > 0) {
    capabilities.push({
      icon: BookText,
      title:
        knowledgeCount === 1
          ? "Reads a knowledge source"
          : `Reads ${knowledgeCount} knowledge sources`,
      description: "Answers from documents its creator gave it.",
    });
  }

  const toolCount = (agent.mcps || []).length;
  if (toolCount > 0) {
    capabilities.push({
      icon: Wrench,
      title:
        toolCount === 1
          ? "Connects to an external tool"
          : `Connects to ${toolCount} external tools`,
      description: "Can take actions in other apps and services.",
    });
  }

  const skillCount = (agent.skills || []).length;
  if (skillCount > 0) {
    capabilities.push({
      icon: Sparkles,
      title:
        skillCount === 1
          ? "Has 1 specialized skill"
          : `Has ${skillCount} specialized skills`,
      description: "Trained for specific kinds of work.",
    });
  }

  return capabilities;
}

export default function AgentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const { isLoaded, isSignedIn } = useAuth();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getProfile();
        setProfile(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to load user profile", err);
      }
    };
    if (isLoaded && isSignedIn) {
      loadProfile();
    }
  }, [isLoaded, isSignedIn]);

  const isOwner =
    profile &&
    agent &&
    String(agent.ownerId) === String(profile.id || profile._id);

  const handleUseAgent = () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/dashboard/agents/${agentId}`);
      return;
    }
    router.push(`/dashboard/agents/${agentId}/run?threadId=new`);
  };

  const handleShareAgent = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Agent link copied to clipboard!");
    }
  };

  useDashboardHeader(
    {
      title: agent?.name || "Agent",
      description: agent?.tagline || "AI agent",
      leading: (
        <Avatar className="ring-primary/10 size-8 ring-2">
          <AvatarImage
            src={agent?.avatarUrl || agent?.avatar}
            alt={agent?.name}
          />
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      actions: (
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground mr-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Explore
          </Link>
          {isOwner && (
            <Link href={studioRoutes.agent(agentId)}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3.5 font-bold shadow-none"
              >
                <SlidersHorizontal className="mr-1.5 size-3.5" />
                Manage in Studio
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            onClick={handleUseAgent}
            disabled={!agent?.isActive || !isLoaded}
            className="h-8 rounded-full px-4 font-bold shadow-none transition-all active:scale-98"
          >
            <Play className="mr-1.5 size-3.5 fill-current" />
            Use Agent
          </Button>
        </div>
      ),
    },
    [agent, agentId, isOwner, isLoaded],
  );

  if (loading) {
    return (
      <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Explore
          </Link>
          <Empty className="bg-card rounded-2xl border border-dashed py-20">
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
  const isVerified = (agent.messageCount || agent.usageCount || 0) > 5;
  const displayAvatar = agent.avatarUrl || agent.avatar;
  const capabilities = capabilitySummary(agent);

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="animate-fade-in mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-8 lg:col-span-2">
            {/* Identity */}
            <Card className="relative overflow-hidden rounded-3xl border border-zinc-150/60 bg-card shadow-none ring-0 dark:border-zinc-900/60">
              <CardContent className="relative px-6 py-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={agent.name}
                      className="size-20 shrink-0 rounded-2xl border border-zinc-150/60 object-cover sm:size-24 sm:rounded-3xl dark:border-zinc-800"
                    />
                  ) : (
                    <div className="from-primary/10 to-primary/5 text-primary flex size-20 shrink-0 items-center justify-center rounded-2xl border border-zinc-150/60 bg-gradient-to-br sm:size-24 sm:rounded-3xl dark:border-zinc-800">
                      <Bot className="size-10 sm:size-12" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/15 rounded-full border-none px-2.5 py-0.5 text-xs font-semibold capitalize"
                      >
                        {agent.category || "other"}
                      </Badge>
                      {!agent.isActive && (
                        <Badge
                          variant="destructive"
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        >
                          Unavailable
                        </Badge>
                      )}
                    </div>

                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
                        {agent.name}
                      </h2>
                      {isVerified && (
                        <span
                          className="animate-fade-in inline-flex shrink-0 text-blue-500"
                          title="Verified Creator"
                        >
                          <BadgeCheck className="size-5.5 fill-current stroke-blue-500 stroke-[2px] text-white dark:text-zinc-950" />
                        </span>
                      )}
                    </div>

                    {agent.tagline && (
                      <p className="text-sm font-semibold text-zinc-600 sm:text-base dark:text-zinc-350">
                        {agent.tagline}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-500 sm:text-sm dark:text-zinc-400">
                      <div className="mr-1 flex items-center gap-0.5">
                        {stars.map((filled, i) => (
                          <Star
                            key={i}
                            className={`size-4 ${
                              filled
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-zinc-200 dark:text-zinc-800"
                            }`}
                          />
                        ))}
                      </div>
                      <span>({agent.reviewCount || 0} reviews)</span>
                      <span className="text-zinc-300 dark:text-zinc-800">
                        •
                      </span>
                      <span>
                        Created by{" "}
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {isOwner ? "You" : "Community Creator"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <Separator className="my-5" />

                <div className="space-y-2">
                  <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                    About this agent
                  </h3>
                  <p className="text-sm leading-relaxed font-medium text-zinc-650 sm:text-base dark:text-zinc-350">
                    {agent.description || "No description provided."}
                  </p>
                </div>

                {agent.tags && agent.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {agent.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-full border-zinc-150/60 bg-zinc-50 px-3 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What it can help with */}
            {capabilities.length > 0 && (
              <Card className="bg-card rounded-3xl border border-zinc-150/60 shadow-none ring-0 dark:border-zinc-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-150">
                    <Sparkles className="text-primary size-4" />
                    What this agent can do
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Capabilities its creator turned on.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {capabilities.map((capability) => (
                      <div
                        key={capability.title}
                        className="flex gap-3 rounded-2xl border border-zinc-150/60 bg-zinc-50/50 p-4 dark:border-zinc-900 dark:bg-zinc-900/10"
                      >
                        <capability.icon className="text-primary mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-150">
                            {capability.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-relaxed font-medium text-zinc-500 dark:text-zinc-400">
                            {capability.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Persona profile */}
            {(agent.bio ||
              (agent.personalityTraits && agent.personalityTraits.length > 0) ||
              (agent.socialLinks &&
                Object.values(agent.socialLinks).some(Boolean))) && (
              <Card className="bg-card rounded-3xl border border-zinc-150/60 shadow-none ring-0 dark:border-zinc-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-150">
                    <UserRound className="text-primary size-4" />
                    Persona Profile
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Who this persona is.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {agent.bio && (
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-zinc-650 dark:text-zinc-350">
                      {agent.bio}
                    </p>
                  )}

                  {agent.personalityTraits &&
                    agent.personalityTraits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.personalityTraits.map((trait) => (
                          <Badge
                            key={trait}
                            variant="secondary"
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          >
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    )}

                  {agent.socialLinks &&
                    Object.values(agent.socialLinks).some(Boolean) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { key: "website", label: "Website" },
                          { key: "twitter", label: "X / Twitter" },
                          { key: "github", label: "GitHub" },
                          { key: "linkedin", label: "LinkedIn" },
                        ]
                          .filter(({ key }) => agent.socialLinks[key])
                          .map(({ key, label }) => (
                            <a
                              key={key}
                              href={agent.socialLinks[key]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-150/60 bg-zinc-50/50 px-3 py-1.5 text-xs font-semibold text-zinc-650 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/10 dark:text-zinc-350 dark:hover:bg-zinc-850"
                            >
                              <Link2 className="size-3.5" />
                              {label}
                            </a>
                          ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            <Card className="bg-card rounded-3xl border border-zinc-150/60 shadow-none ring-0 dark:border-zinc-900/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-150">
                  <MessageSquare className="text-primary size-4" />
                  User Reviews
                </CardTitle>
                <CardDescription className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Feedback from people who have used this agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/20 px-6 py-10 text-center select-none dark:border-zinc-800 dark:bg-zinc-900/5">
                  <MessageSquare className="mb-3 size-8 text-zinc-400 dark:text-zinc-650" />
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No reviews yet
                  </h4>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed font-medium text-zinc-500 dark:text-zinc-400">
                    Be the first to use this agent and leave your thoughts!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <Card className="bg-card space-y-4 rounded-3xl border border-zinc-150/60 p-5 shadow-none ring-0 dark:border-zinc-900/60">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Start a conversation
                </h3>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Chat with this agent or share it with someone.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  onClick={handleUseAgent}
                  disabled={!agent.isActive || !isLoaded}
                  className="h-11 w-full rounded-full text-sm font-bold tracking-wider uppercase shadow-none transition-all hover:shadow-none active:scale-98"
                >
                  <Play className="mr-2 size-4 fill-current" />
                  Launch Agent
                </Button>

                <Button
                  variant="outline"
                  onClick={handleShareAgent}
                  className="h-11 w-full rounded-full border border-zinc-150/60 text-sm font-bold tracking-wider uppercase shadow-none transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <Share2 className="mr-2 size-4" />
                  Share Link
                </Button>
              </div>
            </Card>

            <Card className="bg-card overflow-hidden rounded-3xl border border-zinc-150/60 shadow-none ring-0 dark:border-zinc-900/60">
              <CardHeader className="border-b border-zinc-150/60 pb-4 dark:border-zinc-900/60">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-150">
                  <Sparkles className="text-primary size-4" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-150/60 p-0 dark:divide-zinc-900/60">
                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 font-medium text-zinc-500 dark:text-zinc-400">
                    <MessageSquare className="size-3.5" />
                    <span>Conversations</span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-150">
                    {agent.messageCount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 font-medium text-zinc-500 dark:text-zinc-400">
                    <Users className="size-3.5" />
                    <span>Times used</span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-150">
                    {agent.usageCount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 font-medium text-zinc-500 dark:text-zinc-400">
                    <VisibilityIcon className="size-3.5" />
                    <span>Visibility</span>
                  </div>
                  <span className="font-semibold text-zinc-900 capitalize dark:text-zinc-150">
                    {agent.visibility || "public"}
                  </span>
                </div>

                {agent.createdAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 font-medium text-zinc-500 dark:text-zinc-400">
                      <Calendar className="size-3.5" />
                      <span>Created</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {isOwner && (
              <Card className="bg-card rounded-3xl border border-dashed border-zinc-200 p-5 shadow-none ring-0 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  You own this agent
                </h3>
                <p className="mt-1 text-xs leading-relaxed font-medium text-zinc-500 dark:text-zinc-400">
                  Instructions, model, skills, knowledge, connectors, memory,
                  and publishing all live in Agent Studio.
                </p>
                <Link href={studioRoutes.agent(agentId)} className="mt-4 block">
                  <Button
                    variant="outline"
                    className="w-full rounded-full font-bold"
                  >
                    <SlidersHorizontal className="mr-2 size-4" />
                    Open in Studio
                  </Button>
                </Link>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
