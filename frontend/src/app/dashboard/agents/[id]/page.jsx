"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Bot,
  Users,
  Calendar,
  Loader2,
  Globe,
  Lock,
  EyeOff,
  Brain,
  Cpu,
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

// Sub-components
import AgentOverviewCard from "./components/AgentOverviewCard";
import AgentSkillsCard from "./components/AgentSkillsCard";
import AgentInstructionsCard from "./components/AgentInstructionsCard";
import AgentDetailPageSkeleton from "./components/AgentDetailPageSkeleton";

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
                className="h-8 rounded-full px-3.5 font-bold transition-all hover:bg-muted"
              >
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
    return <AgentDetailPageSkeleton />;
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

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-8 lg:col-span-2">
            <AgentOverviewCard
              agent={agent}
              isOwner={isOwner}
              VisibilityIcon={VisibilityIcon}
            />

            <AgentSkillsCard skills={agent.skills} />

            <AgentInstructionsCard systemPrompt={agent.systemPrompt} />

            {/* Reviews Card */}
            <Card className="border-none ring-1 ring-foreground/10 bg-card">
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
                    <EmptyTitle className="text-sm font-bold">
                      No reviews yet
                    </EmptyTitle>
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
            <Card className="border-none ring-1 ring-foreground/10 bg-card p-5 space-y-4">
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
                  className="w-full h-11 font-bold text-sm uppercase tracking-tight transition-all"
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
            <Card className="border-none ring-1 ring-foreground/10 overflow-hidden bg-card">
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
