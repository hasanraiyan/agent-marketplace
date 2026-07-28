"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookTextIcon,
  BotIcon,
  BrainIcon,
  CpuIcon,
  EyeIcon,
  GlobeIcon,
  Loader2,
  LockIcon,
  MessageSquareIcon,
  PencilIcon,
  PlayIcon,
  PlugIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAgent,
  updateAgent,
  getAgentMemory,
  deleteAgentMemory,
} from "@/lib/api/agents";
import { getProviders } from "@/lib/api/providers";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { StudioAgentTabs } from "@/components/studio/studio-agent-tabs";

const VISIBILITY_OPTIONS = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see and use this agent",
    icon: LockIcon,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link can use it",
    icon: EyeIcon,
  },
  {
    value: "public",
    label: "Public",
    description: "Listed on Explore for everyone",
    icon: GlobeIcon,
  },
];

function Card({ title, description, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-150/70 bg-white dark:border-slate-850/60 dark:bg-slate-950/40">
      <header className="flex items-start justify-between gap-3 border-b border-slate-150/70 px-5 py-4 dark:border-slate-850/60">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-xs">
      <span className="font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

function CapabilityLink({ icon: Icon, label, count, href }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-slate-150/70 bg-slate-50/50 px-4 py-3 transition-colors hover:bg-slate-100/60 dark:border-slate-850/60 dark:bg-slate-900/20 dark:hover:bg-slate-900/50"
    >
      <Icon className="size-4 shrink-0 text-slate-450 dark:text-slate-500" />
      <span className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100">
        {label}
      </span>
      <span className="text-xs font-bold text-slate-450 tabular-nums dark:text-slate-500">
        {count}
      </span>
    </Link>
  );
}

export default function StudioAgentOverviewPage({ params }) {
  const { id: agentId } = use(params);

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getAgent(agentId), getProviders()])
      .then(([agentRes, provRes]) => {
        if (cancelled) return;
        if (agentRes.status === "fulfilled") {
          setAgent(agentRes.value.data?.data || null);
        } else {
          toast.error("Failed to load agent");
        }
        if (provRes.status === "fulfilled") {
          setProviders(provRes.value.data?.data || []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMemory(true);
    getAgentMemory(agentId)
      .then((res) => {
        if (!cancelled) setMemories(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setMemories([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMemory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const patchAgent = useCallback(
    async (patch, successMessage) => {
      setPublishing(true);
      const previous = agent;
      setAgent((prev) => ({ ...prev, ...patch }));
      try {
        const res = await updateAgent(agentId, patch);
        const updated = res.data?.data;
        if (updated) setAgent(updated);
        toast.success(successMessage);
      } catch (err) {
        setAgent(previous);
        toast.error(err.response?.data?.message || "Update failed");
      } finally {
        setPublishing(false);
      }
    },
    [agent, agentId],
  );

  const handleDeleteMemory = async (path) => {
    try {
      await deleteAgentMemory(agentId, path);
      setMemories((prev) => prev.filter((m) => m.path !== path));
      toast.success("Memory file deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete memory");
    }
  };

  useDashboardHeader(
    {
      title: agent?.name || "Agent",
      description: agent?.tagline || "Agent workspace",
      leading: (
        <Avatar className="size-8">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} alt="" />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      tabs: <StudioAgentTabs agentId={agentId} active="overview" />,
      actions: (
        <>
          <Link href={`/studio/agents/${agentId}/build`}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-bold"
            >
              <PencilIcon className="mr-1.5 size-3.5" />
              Build
            </Button>
          </Link>
          <Link href={`/studio/agents/${agentId}/test`}>
            <Button size="sm" className="rounded-full px-4 font-bold">
              <PlayIcon className="mr-1.5 size-3.5 fill-current" />
              Test
            </Button>
          </Link>
        </>
      ),
    },
    [agent, agentId],
  );

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-3">
          <BotIcon className="mx-auto size-10 text-slate-300 dark:text-slate-700" />
          <h2 className="text-lg font-bold">Agent not found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            It may have been deleted, or you may not own it.
          </p>
          <Link href="/studio/agents">
            <Button variant="outline" className="rounded-full font-bold">
              Back to agents
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const provider = providers.find(
    (p) => String(p.id || p._id) === String(agent.providerId),
  );
  const skills = agent.skills || [];
  const mcps = agent.mcps || [];
  const knowledgeBases = agent.knowledgeBases || [];

  return (
    <div className="@container/main min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8">
        {/* Identity */}
        <Card
          title="Identity"
          description="How this agent introduces itself."
          action={
            <Link href={`/studio/agents/${agentId}/build`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs font-bold"
              >
                Edit
              </Button>
            </Link>
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {agent.avatarUrl || agent.avatar ? (
              <img
                src={agent.avatarUrl || agent.avatar}
                alt=""
                className="size-20 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                <BotIcon className="size-9" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  {agent.name}
                </h3>
                <Badge
                  variant="secondary"
                  className="rounded-full px-2.5 py-0 text-[10px] font-bold uppercase"
                >
                  {agent.category || "other"}
                </Badge>
                {agent.isMainAgent ? (
                  <Badge className="rounded-full px-2.5 py-0 text-[10px] font-bold uppercase">
                    Main clone
                  </Badge>
                ) : null}
              </div>
              {agent.tagline ? (
                <p className="text-sm font-semibold text-slate-650 dark:text-slate-350">
                  {agent.tagline}
                </p>
              ) : null}
              <p className="text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                {agent.description || "No description yet."}
              </p>
              {agent.tags?.length ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {agent.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="rounded-full px-2.5 py-0 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Publishing */}
        <Card
          title="Publishing"
          description="Control who can find and run this agent."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Visibility
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {
                    VISIBILITY_OPTIONS.find(
                      (o) => o.value === (agent.visibility || "private"),
                    )?.description
                  }
                </div>
              </div>
              <Select
                value={agent.visibility || "private"}
                disabled={publishing}
                onValueChange={(value) =>
                  patchAgent(
                    { visibility: value },
                    `Visibility set to ${value}`,
                  )
                }
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <option.icon className="size-3.5" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-150/70 pt-4 dark:border-slate-850/60">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Active
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Inactive agents cannot be launched by anyone, including you.
                </div>
              </div>
              <Switch
                checked={agent.isActive !== false}
                disabled={publishing}
                onCheckedChange={(checked) =>
                  patchAgent(
                    { isActive: checked },
                    checked ? "Agent activated" : "Agent deactivated",
                  )
                }
              />
            </div>
          </div>
        </Card>

        {/* Configuration + usage */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card
            title="Configuration"
            description="What powers this agent."
            action={
              <Link href={`/studio/agents/${agentId}/build`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full text-xs font-bold"
                >
                  Configure
                </Button>
              </Link>
            }
          >
            <div className="divide-y divide-slate-150/70 dark:divide-slate-850/60">
              <Row label="Provider" value={provider?.name || "Not set"} />
              <Row label="Model" value={agent.modelName || "Not set"} />
              <Row
                label="Web search"
                value={agent.webSearchEnabled ? "Enabled" : "Disabled"}
              />
              <Row
                label="Instructions"
                value={
                  agent.systemPrompt
                    ? `${agent.systemPrompt.length} characters`
                    : "None"
                }
              />
            </div>
          </Card>

          <Card title="Usage" description="Recorded by the runtime.">
            <div className="divide-y divide-slate-150/70 dark:divide-slate-850/60">
              <Row
                label="Messages"
                value={
                  <span className="flex items-center gap-1.5">
                    <MessageSquareIcon className="size-3.5 text-slate-400" />
                    {agent.messageCount || 0}
                  </span>
                }
              />
              <Row
                label="Runs"
                value={
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="size-3.5 text-slate-400" />
                    {agent.usageCount || 0}
                  </span>
                }
              />
              <Row
                label="Created"
                value={
                  agent.createdAt
                    ? new Date(agent.createdAt).toLocaleDateString()
                    : "—"
                }
              />
              <Row
                label="Last updated"
                value={
                  agent.updatedAt
                    ? new Date(agent.updatedAt).toLocaleDateString()
                    : "—"
                }
              />
            </div>
          </Card>
        </div>

        {/* Capabilities */}
        <Card
          title="Capabilities"
          description="Skills, knowledge, and connectors attached to this agent."
          action={
            <Link href={`/studio/agents/${agentId}/build`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs font-bold"
              >
                Attach
              </Button>
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CapabilityLink
              icon={CpuIcon}
              label="Skills"
              count={skills.length}
              href="/dashboard/connectors/skills"
            />
            <CapabilityLink
              icon={BookTextIcon}
              label="Knowledge"
              count={knowledgeBases.length}
              href="/dashboard/connectors/knowledge"
            />
            <CapabilityLink
              icon={PlugIcon}
              label="Connectors"
              count={mcps.length}
              href="/dashboard/connectors/mcps"
            />
          </div>
        </Card>

        {/* Memory */}
        <Card
          title="Long-term memory"
          description="Files this agent keeps for you across conversations."
        >
          {loadingMemory ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-slate-400" />
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center dark:border-slate-800">
              <BrainIcon className="mb-2.5 size-7 text-slate-300 dark:text-slate-700" />
              <p className="max-w-xs text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                Nothing stored yet. As you chat, the agent writes what it learns
                into memory files here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-150/70 dark:divide-slate-850/60">
              {memories.map((memory) => (
                <li
                  key={memory.path}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {memory.path}
                    </div>
                    <pre className="mt-1.5 max-h-28 overflow-y-auto rounded-lg bg-slate-50 p-2.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                      {memory.content}
                    </pre>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-full text-slate-400 hover:text-red-500"
                    title="Delete memory file"
                    onClick={() => handleDeleteMemory(memory.path)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
