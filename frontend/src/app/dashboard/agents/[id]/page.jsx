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
  Brain,
  Cpu,
  Server,
  BookText,
  Copy,
  Check,
  Share2,
  MessageSquare,
  Edit,
  Sparkles,
  BadgeCheck,
  Trash2,
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
import { getAgent, getAgentMemory, deleteAgentMemory } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";
import { useDashboardHeader } from "@/components/dashboard-header-context";

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
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(true);

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

  useEffect(() => {
    const fetchMemory = async () => {
      setLoadingMemory(true);
      try {
        const res = await getAgentMemory(agentId);
        setMemories(res.data?.data || []);
      } catch (err) {
        console.error("Failed to load agent memories", err);
        toast.error("Failed to load agent memory");
      } finally {
        setLoadingMemory(false);
      }
    };
    if (isOwner) {
      fetchMemory();
    }
  }, [isOwner, agentId]);

  const handleDeleteMemory = async (path) => {
    if (!window.confirm("Are you sure you want to delete this memory file?")) {
      return;
    }
    try {
      await deleteAgentMemory(agentId, path);
      setMemories((prev) => prev.filter((m) => m.path !== path));
      toast.success("Memory file deleted successfully");
    } catch (err) {
      console.error("Failed to delete memory file", err);
      toast.error(err.response?.data?.message || "Failed to delete memory");
    }
  };

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

  const handleCopyText = (text) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Instructions copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Dashboard header integration ─────────────────────────────────────────────
  useDashboardHeader(
    {
      title: agent?.name || "Agent Details",
      description: agent?.category
        ? `${agent.category} Agent`
        : "AI Agent Details",
      leading: (
        <Avatar className="size-8 ring-2 ring-primary/10">
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
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            <ArrowLeft className="size-4" />
            Explore
          </Link>
          {isOwner && (
            <Link href={`/dashboard/agents/${agentId}/builder`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3.5 font-bold transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-150/60 dark:border-zinc-800 shadow-none"
              >
                <Edit className="mr-1.5 size-3.5" />
                Edit
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            onClick={handleUseAgent}
            disabled={!agent?.isActive || !isLoaded}
            className="h-8 rounded-full px-4 font-bold shadow-none active:scale-98 transition-all"
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
              <Skeleton className="h-48 rounded-2xl w-full" />
              <Skeleton className="h-64 rounded-2xl w-full" />
              <Skeleton className="h-64 rounded-2xl w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-80 rounded-2xl w-full" />
              <Skeleton className="h-40 rounded-2xl w-full" />
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
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Explore
          </Link>
          <Empty className="py-20 border border-dashed rounded-2xl bg-card">
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

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-8 lg:col-span-2">
            {/* Overview / Identity Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden relative">
              <CardContent className="relative px-6 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={agent.name}
                      className="size-20 sm:size-24 rounded-2xl sm:rounded-3xl object-cover border border-zinc-150/60 dark:border-zinc-800 shrink-0"
                    />
                  ) : (
                    <div className="size-20 sm:size-24 rounded-2xl sm:rounded-3xl border border-zinc-150/60 dark:border-zinc-800 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                      <Bot className="size-10 sm:size-12" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className="capitalize text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary hover:bg-primary/15 border-none rounded-full"
                      >
                        {agent.category || "other"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="capitalize text-xs font-semibold px-2.5 py-0.5 border-zinc-150/60 dark:border-zinc-800 bg-background/50 flex items-center gap-1 rounded-full text-zinc-650 dark:text-zinc-350"
                      >
                        <VisibilityIcon className="size-3" />
                        {agent.visibility || "public"}
                      </Badge>
                      {!agent.isActive && (
                        <Badge
                          variant="destructive"
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                        {agent.name}
                      </h2>
                      {isVerified && (
                        <span
                          className="inline-flex text-blue-500 shrink-0 animate-fade-in"
                          title="Verified Creator"
                        >
                          <BadgeCheck className="size-5.5 fill-current text-white dark:text-zinc-950 stroke-blue-500 stroke-[2px]" />
                        </span>
                      )}
                    </div>

                    {agent.tagline && (
                      <p className="text-sm sm:text-base font-semibold text-zinc-600 dark:text-zinc-350">
                        {agent.tagline}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      <div className="flex gap-0.5 items-center mr-1">
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
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    About this agent
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-zinc-650 dark:text-zinc-350 font-medium">
                    {agent.description || "No description provided."}
                  </p>
                </div>

                {agent.tags && agent.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {agent.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900 border-zinc-150/60 dark:border-zinc-800 rounded-full px-3 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Persona Profile Card */}
            {(agent.bio ||
              (agent.personalityTraits && agent.personalityTraits.length > 0) ||
              (agent.socialLinks &&
                Object.values(agent.socialLinks).some(Boolean))) && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <UserRound className="size-4 text-primary" />
                    Persona Profile
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Who this persona is, beyond the config.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {agent.bio && (
                    <p className="text-sm leading-relaxed text-zinc-650 dark:text-zinc-350 font-medium whitespace-pre-wrap">
                      {agent.bio}
                    </p>
                  )}

                  {agent.personalityTraits && agent.personalityTraits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {agent.personalityTraits.map((trait) => (
                        <Badge
                          key={trait}
                          variant="secondary"
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
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
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-150/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 px-3 py-1.5 text-xs font-semibold text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors"
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

            {/* Configured Skills Card */}
            {agent.skills && agent.skills.length > 0 && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <Cpu className="size-4 text-primary" />
                    Configured Skills
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Specialized capabilities and instructions attached to this
                    agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {agent.skills.map((skill) => {
                      const skillId =
                        typeof skill === "string"
                          ? skill
                          : skill._id || skill.id;
                      return (
                        <Link
                          key={skillId}
                          href={`/dashboard/connectors/skills/${skillId}`}
                          className="p-4 rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-1.5 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                        >
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-150">
                            {skill.name || "Skill"}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                            {skill.description || "No description provided."}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Configured MCP Servers Card */}
            {agent.mcps && agent.mcps.length > 0 && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <Server className="size-4 text-primary" />
                    Configured MCP Servers
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    External data sources, APIs, and tools attached to this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {agent.mcps.map((mcp) => {
                      const mcpId = typeof mcp === "string" ? mcp : mcp._id || mcp.id;
                      const hasDetails = typeof mcp === "object" && mcp !== null;
                      return (
                        <Link
                          key={mcpId}
                          href={`/dashboard/connectors/mcps/${mcpId}`}
                          className="p-4 rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-1.5 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                        >
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-150 flex items-center justify-between">
                            <span>{hasDetails ? mcp.name : "MCP Server"}</span>
                            {hasDetails && mcp.transport && (
                              <Badge className="text-[8px] h-3.5 px-1.5 uppercase font-extrabold">{mcp.transport}</Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                            {hasDetails ? mcp.description || "No description provided." : "View MCP details"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Configured Knowledge Bases Card */}
            {agent.knowledgeBases && agent.knowledgeBases.length > 0 && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <BookText className="size-4 text-primary" />
                    Configured Knowledge Bases
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Document collections enabling AI-powered semantic search and RAG for this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {agent.knowledgeBases.map((kb) => {
                      const kbId = typeof kb === "string" ? kb : kb._id || kb.id;
                      const hasDetails = typeof kb === "object" && kb !== null;
                      return (
                        <Link
                          key={kbId}
                          href={`/dashboard/connectors/knowledge/${kbId}`}
                          className="p-4 rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-1.5 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                        >
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-150 flex items-center justify-between">
                            <span>{hasDetails ? kb.name : "Knowledge Base"}</span>
                            {hasDetails && (
                              <Badge className="text-[8px] h-3.5 px-1.5 uppercase font-extrabold">{kb.documentCount || 0} docs</Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                            {hasDetails ? kb.description || "No description provided." : "View Knowledge Base details"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Prompt Instructions */}
            {agent.systemPrompt && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                      <Brain className="size-4 text-primary" />
                      Instructions
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      The core guidelines and rules shaping this agent&apos;s
                      behavior.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(agent.systemPrompt)}
                    className="h-8 rounded-full px-3.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border border-zinc-150/60 dark:border-zinc-800"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 size-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/10 p-5 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap select-all scrollbar-thin text-zinc-700 dark:text-zinc-300">
                      {agent.systemPrompt}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Agent Memory Card */}
            {isOwner && (
              <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <Brain className="size-4 text-primary" />
                    AI Agent Memory (Long-term)
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Memory files this agent keeps for you across conversations
                    (/memories/agent/). Only you can view or manage them.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingMemory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-zinc-400" />
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center select-none">
                      <Brain className="size-8 text-zinc-400 dark:text-zinc-650 mb-3" />
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        No memories stored yet
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed font-medium">
                        As you chat with this agent, it will save memory files
                        with learnings, facts, and preferences.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-hidden border border-zinc-150/60 dark:border-zinc-900 rounded-2xl bg-zinc-50/40 dark:bg-zinc-900/10">
                        <div className="overflow-x-auto font-sans">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-zinc-150/60 dark:border-zinc-900/60 bg-zinc-100/40 dark:bg-zinc-900/20 text-zinc-500 dark:text-zinc-400 font-bold">
                                <th className="p-3.5">Memory File</th>
                                <th className="p-3.5">Content</th>
                                <th className="p-3.5">Last Updated</th>
                                <th className="p-3.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-150/60 dark:divide-zinc-900/60 text-zinc-700 dark:text-zinc-300">
                              {memories.map((mem) => (
                                <tr
                                  key={mem.path}
                                  className="hover:bg-zinc-100/20 dark:hover:bg-zinc-900/10 transition-colors"
                                >
                                  <td
                                    className="p-3.5 font-semibold font-mono text-[11px] max-w-[150px] truncate"
                                    title={mem.path}
                                  >
                                    {mem.path}
                                  </td>
                                  <td className="p-3.5 font-medium leading-relaxed max-w-[320px]">
                                    <pre className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {mem.content}
                                    </pre>
                                  </td>
                                  <td className="p-3.5 text-zinc-500 font-medium">
                                    {mem.updatedAt
                                      ? new Date(
                                          mem.updatedAt,
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleDeleteMemory(mem.path)
                                      }
                                      className="size-8 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reviews Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <MessageSquare className="size-4 text-primary" />
                  User Reviews
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Feedback from other developers and users who ran this agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-10 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center select-none">
                  <MessageSquare className="size-8 text-zinc-400 dark:text-zinc-650 mb-3" />
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No reviews yet
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed font-medium">
                    Be the first to run this agent and leave your thoughts!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="space-y-8">
            {/* Quick Actions Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl p-5 space-y-4 ring-0 shadow-none">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Actions
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Launch a chat session or share this agent.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  onClick={handleUseAgent}
                  disabled={!agent.isActive || !isLoaded}
                  className="w-full h-11 font-bold text-sm rounded-full shadow-none hover:shadow-none active:scale-98 transition-all uppercase tracking-wider"
                >
                  <Play className="mr-2 size-4 fill-current" />
                  Launch Agent
                </Button>

                <Button
                  variant="outline"
                  onClick={handleShareAgent}
                  className="w-full h-11 font-bold text-sm rounded-full border border-zinc-150/60 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all uppercase tracking-wider shadow-none"
                >
                  <Share2 className="mr-2 size-4" />
                  Share Link
                </Button>
              </div>
            </Card>

            {/* Details Metadata Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardHeader className="pb-4 border-b border-zinc-150/60 dark:border-zinc-900/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <Sparkles className="size-4 text-primary" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-150/60 dark:divide-zinc-900/60 p-0">
                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Brain className="size-3.5" />
                    <span>Base Model</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-[10px]">
                    {agent.modelName || "Default"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Globe className="size-3.5" />
                    <span>Web Search</span>
                  </div>
                  <Badge
                    variant={agent.webSearchEnabled ? "default" : "outline"}
                    className={`text-[10px] font-bold px-2 py-0.5 border-none ${
                      agent.webSearchEnabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {agent.webSearchEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Cpu className="size-3.5" />
                    <span>Category</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize">
                    {agent.category || "other"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <VisibilityIcon className="size-3.5" />
                    <span>Visibility</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize">
                    {agent.visibility || "public"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Users className="size-3.5" />
                    <span>Usage Count</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 font-bold">
                    {agent.usageCount || 0} runs
                  </span>
                </div>

                {agent.createdAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Created</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {agent.updatedAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Last Updated</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(agent.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
