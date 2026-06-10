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
  Copy,
  Check,
  Share2,
  MessageSquare,
  Edit,
  Sparkles,
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
  const [starting, setStarting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);

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

  const handleUseAgent = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/dashboard/agents/${agentId}`);
      return;
    }
    setStarting(true);
    try {
      const res = await createThread({ agentId });
      const thread = res.data?.data;
      const tid = thread?.id || thread?._id;
      if (tid) {
        router.push(`/dashboard/agents/${agentId}/run?threadId=${tid}`);
      } else {
        router.push(`/dashboard/agents/${agentId}/run`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start chat");
      setStarting(false);
    }
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
      description: agent?.category ? `${agent.category} Agent` : "AI Agent Details",
      leading: (
        <Avatar className="size-8 ring-2 ring-primary/10">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} alt={agent?.name} />
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
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3.5 font-bold transition-all hover:bg-muted">
                <Edit className="mr-1.5 size-3.5" />
                Edit
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            onClick={handleUseAgent}
            disabled={starting || !agent?.isActive || !isLoaded}
            className="h-8 rounded-full px-4 font-bold shadow-sm"
          >
            {starting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-1.5 size-3.5 fill-current" />
                Use Agent
              </>
            )}
          </Button>
        </div>
      ),
    },
    [agent, agentId, isOwner, starting, isLoaded],
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

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-8 lg:col-span-2">
            
            {/* Overview / Identity Card */}
            <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-card to-card/95 ring-1 ring-foreground/5 relative">
              <div className="h-32 w-full bg-gradient-to-r from-blue-600/20 via-indigo-600/10 to-transparent dark:from-blue-600/15 dark:via-indigo-600/5 relative">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]" />
              </div>

              <CardContent className="relative px-6 pb-6 pt-0">
                <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-12 mb-4">
                  <Avatar className="size-24 border-4 border-card shadow-lg ring-1 ring-foreground/5 rounded-2xl bg-card shrink-0">
                    <AvatarImage src={agent.avatarUrl || agent.avatar} alt={agent.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                      <Bot className="size-10" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge variant="secondary" className="capitalize text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary hover:bg-primary/15 border-none">
                        {agent.category || "other"}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-xs font-semibold px-2.5 py-0.5 border-foreground/10 bg-background/50 flex items-center gap-1">
                        <VisibilityIcon className="size-3" />
                        {agent.visibility || "public"}
                      </Badge>
                      {!agent.isActive && (
                        <Badge variant="destructive" className="text-xs font-semibold px-2.5 py-0.5">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">
                      {agent.name}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <div className="flex gap-0.5 mr-1">
                        {stars.map((filled, i) => (
                          <Star
                            key={i}
                            className={`size-3.5 ${
                              filled
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <span>({agent.reviewCount || 0} reviews)</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span>Created by <span className="font-semibold text-foreground">{isOwner ? "You" : "Community Creator"}</span></span>
                    </div>
                  </div>
                </div>

                <Separator className="my-5" />

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-foreground/75 uppercase tracking-wider">About this agent</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {agent.description || "No description provided."}
                  </p>
                </div>

                {agent.tags && agent.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs text-muted-foreground bg-muted/30 border-muted/50 rounded-full px-2.5 py-0.5 hover:bg-muted/50 transition-colors">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configured Skills Card */}
            {agent.skills && agent.skills.length > 0 && (
              <Card className="border-none shadow-md ring-1 ring-foreground/5">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Cpu className="size-4 text-primary" />
                    Configured Skills
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Specialized capabilities and instructions attached to this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {agent.skills.map((skill) => (
                      <div key={skill._id || skill.id} className="p-3.5 rounded-xl border bg-muted/10 flex flex-col gap-1.5 transition-colors hover:bg-muted/20">
                        <span className="text-xs font-bold text-foreground">{skill.name}</span>
                        <span className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {skill.description || "No description provided."}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Prompt Instructions */}
            {agent.systemPrompt && (
              <Card className="border-none shadow-md ring-1 ring-foreground/5 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Brain className="size-4 text-primary" />
                      Instructions
                    </CardTitle>
                    <CardDescription className="text-xs">
                      The core guidelines and rules shaping this agent&apos;s behavior.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(agent.systemPrompt)}
                    className="h-8 rounded-lg px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
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
                    <div className="rounded-xl border bg-muted/20 p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap select-all scrollbar-thin">
                      {agent.systemPrompt}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews Card */}
            <Card className="border-none shadow-md ring-1 ring-foreground/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  User Reviews
                </CardTitle>
                <CardDescription className="text-xs">
                  Feedback from other developers and users who ran this agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Empty className="py-10 border border-dashed rounded-xl bg-muted/5">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm font-bold">No reviews yet</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Be the first to run this agent and leave your thoughts!
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>

          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="space-y-8">
            
            {/* Quick Actions Card */}
            <Card className="border-none shadow-md ring-1 ring-foreground/5 bg-gradient-to-br from-card to-muted/10 p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Actions</h3>
                <p className="text-xs text-muted-foreground">
                  Launch a chat session or share this agent.
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  onClick={handleUseAgent}
                  disabled={starting || !agent.isActive || !isLoaded}
                  className="w-full h-11 font-bold text-sm uppercase tracking-tight shadow-md hover:shadow-lg transition-all"
                >
                  {starting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 size-4 fill-current" />
                      Launch Agent
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleShareAgent}
                  className="w-full h-11 font-semibold text-sm rounded-xl border-foreground/10 hover:bg-muted transition-all"
                >
                  <Share2 className="mr-2 size-4" />
                  Share Link
                </Button>
              </div>
            </Card>

            {/* Metadata Card */}
            <Card className="border-none shadow-md ring-1 ring-foreground/5 overflow-hidden">
              <CardHeader className="bg-muted/10 border-b pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-foreground/5 p-0">
                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Brain className="size-3.5" />
                    <span>Base Model</span>
                  </div>
                  <span className="font-semibold text-foreground font-mono bg-muted px-2 py-0.5 rounded text-[10px]">
                    {agent.modelName || "Default"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="size-3.5" />
                    <span>Web Search</span>
                  </div>
                  <Badge
                    variant={agent.webSearchEnabled ? "default" : "outline"}
                    className={`text-[10px] font-bold px-2 py-0.5 border-none ${
                      agent.webSearchEnabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {agent.webSearchEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Cpu className="size-3.5" />
                    <span>Category</span>
                  </div>
                  <span className="font-semibold text-foreground capitalize">
                    {agent.category || "other"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <VisibilityIcon className="size-3.5" />
                    <span>Visibility</span>
                  </div>
                  <span className="font-semibold text-foreground capitalize">
                    {agent.visibility || "public"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>Usage Count</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {agent.usageCount || 0} runs
                  </span>
                </div>

                {agent.createdAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      <span>Created</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {agent.updatedAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      <span>Last Updated</span>
                    </div>
                    <span className="font-semibold text-foreground">
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
