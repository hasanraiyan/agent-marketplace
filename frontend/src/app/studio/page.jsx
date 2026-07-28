"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookTextIcon,
  BotIcon,
  CpuIcon,
  GlobeIcon,
  LockIcon,
  MessageSquareIcon,
  PlugIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchAgents } from "@/lib/api/agents";
import { getProfile } from "@/lib/api/profile";
import { getProviders } from "@/lib/api/providers";
import { getMySkills } from "@/lib/api/skills";
import { getMyMcps } from "@/lib/api/mcps";
import { getMyKnowledgeBases } from "@/lib/api/knowledge";
import { useDashboardHeader } from "@/components/dashboard-header-context";

const VISIBILITY_ICON = {
  public: GlobeIcon,
  unlisted: SparklesIcon,
  private: LockIcon,
};

/**
 * Reasons an agent needs the creator's attention. Every check reads a field the
 * backend actually returns — no invented signals.
 */
function attentionReasons(agent) {
  const reasons = [];
  if (!agent.providerId || !agent.modelName)
    reasons.push("No model configured");
  if (!agent.systemPrompt) reasons.push("No instructions");
  if (!agent.description) reasons.push("No description");
  if (agent.isActive === false) reasons.push("Inactive");
  return reasons;
}

function StatTile({ label, value, icon: Icon, loading }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-150/70 bg-white p-5 dark:border-slate-850/60 dark:bg-slate-950/40">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12 rounded-md" />
      ) : (
        <div className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
          {value}
        </div>
      )}
    </div>
  );
}

function ResourceCard({ href, title, count, loading, icon: Icon, hint }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-150/70 bg-white p-4 transition-all hover:border-slate-250 dark:border-slate-850/60 dark:bg-slate-950/40 dark:hover:border-slate-700"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-650 dark:bg-slate-900 dark:text-slate-350">
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {loading ? "…" : hint ? hint : `${count} configured`}
        </div>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-slate-350 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}

export default function StudioHomePage() {
  const { isLoaded, isSignedIn } = useAuth();

  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [providers, setProviders] = useState([]);
  const [resources, setResources] = useState({ skills: 0, mcps: 0, kbs: 0 });
  const [loadingResources, setLoadingResources] = useState(true);

  useDashboardHeader(
    {
      title: "Agent Studio",
      description: "Build, configure, test, and publish your agents.",
      actions: (
        <Link href="/studio/agents/new">
          <Button size="sm" className="rounded-full px-4 font-bold">
            <PlusIcon className="mr-1.5 size-4" />
            New Agent
          </Button>
        </Link>
      ),
    },
    [],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    const loadAgents = async () => {
      try {
        const profileRes = await getProfile();
        const profile = profileRes.data?.data || profileRes.data;
        const ownerId = profile?.id || profile?._id;
        if (!ownerId) throw new Error("Missing profile");

        const res = await searchAgents({
          ownerId,
          page: 1,
          limit: 100,
          sortBy: "newest",
        });
        if (!cancelled) setAgents(res.data?.data || []);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Failed to load your agents",
          );
          setAgents([]);
        }
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    };

    const loadResources = async () => {
      const [prov, skills, mcps, kbs] = await Promise.allSettled([
        getProviders(),
        getMySkills(),
        getMyMcps(),
        getMyKnowledgeBases(),
      ]);
      if (cancelled) return;
      if (prov.status === "fulfilled")
        setProviders(prov.value.data?.data || []);
      setResources({
        skills:
          skills.status === "fulfilled"
            ? (skills.value.data?.data || []).length
            : 0,
        mcps:
          mcps.status === "fulfilled"
            ? (mcps.value.data?.data || []).length
            : 0,
        kbs:
          kbs.status === "fulfilled" ? (kbs.value.data?.data || []).length : 0,
      });
      setLoadingResources(false);
    };

    loadAgents();
    loadResources();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const stats = useMemo(() => {
    const published = agents.filter((a) => a.visibility === "public").length;
    const messages = agents.reduce((sum, a) => sum + (a.messageCount || 0), 0);
    return { total: agents.length, published, messages };
  }, [agents]);

  const needsAttention = useMemo(
    () =>
      agents
        .map((agent) => ({ agent, reasons: attentionReasons(agent) }))
        .filter(({ reasons }) => reasons.length > 0)
        .slice(0, 5),
    [agents],
  );

  const recent = useMemo(
    () =>
      [...agents]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) -
            new Date(a.updatedAt || a.createdAt || 0),
        )
        .slice(0, 6),
    [agents],
  );

  const noProviders = !loadingResources && providers.length === 0;

  return (
    <div className="@container/main min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {noProviders ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  No LLM provider connected
                </div>
                <div className="text-xs font-medium text-amber-800/80 dark:text-amber-300/80">
                  Agents need a provider API key before they can run or be
                  tested.
                </div>
              </div>
            </div>
            <Link href="/dashboard/settings/providers">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full font-bold"
              >
                Connect a provider
              </Button>
            </Link>
          </div>
        ) : null}

        {/* At a glance */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Agents"
            value={stats.total}
            icon={BotIcon}
            loading={loadingAgents}
          />
          <StatTile
            label="Published"
            value={stats.published}
            icon={GlobeIcon}
            loading={loadingAgents}
          />
          <StatTile
            label="Total chats"
            value={stats.messages}
            icon={MessageSquareIcon}
            loading={loadingAgents}
          />
        </section>

        {/* Needs attention */}
        {!loadingAgents && needsAttention.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Needs attention
            </h2>
            <div className="divide-y divide-slate-150/70 overflow-hidden rounded-2xl border border-slate-150/70 bg-white dark:divide-slate-850/60 dark:border-slate-850/60 dark:bg-slate-950/40">
              {needsAttention.map(({ agent, reasons }) => {
                const id = agent.id || agent._id;
                return (
                  <Link
                    key={id}
                    href={`/studio/agents/${id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <AlertTriangleIcon className="size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {agent.name}
                    </span>
                    <span className="hidden gap-1.5 sm:flex">
                      {reasons.map((reason) => (
                        <Badge
                          key={reason}
                          variant="outline"
                          className="rounded-full px-2 py-0 text-[10px] font-bold text-slate-500 dark:text-slate-400"
                        >
                          {reason}
                        </Badge>
                      ))}
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-slate-350 dark:text-slate-600" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Recently modified */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Recently modified
            </h2>
            <Link
              href="/studio/agents"
              className="text-xs font-bold text-[#1E60FF] hover:underline"
            >
              All agents
            </Link>
          </div>

          {loadingAgents ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-150/70 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-850/60 dark:bg-slate-950/20">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                <BotIcon className="size-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nothing built yet
              </h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                Create your first agent — describe it to Sage or fill in the
                configuration yourself.
              </p>
              <Link href="/studio/agents/new" className="mt-5">
                <Button className="rounded-full px-6 font-bold">
                  <PlusIcon className="mr-1.5 size-4" />
                  New Agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((agent) => {
                const id = agent.id || agent._id;
                const VisibilityIcon =
                  VISIBILITY_ICON[agent.visibility] || LockIcon;
                return (
                  <Link
                    key={id}
                    href={`/studio/agents/${id}`}
                    className="group flex flex-col gap-2 rounded-2xl border border-slate-150/70 bg-white p-4 transition-all hover:border-slate-250 dark:border-slate-850/60 dark:bg-slate-950/40 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      {agent.avatarUrl || agent.avatar ? (
                        <img
                          src={agent.avatarUrl || agent.avatar}
                          alt=""
                          className="size-9 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                          <BotIcon className="size-4.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                          {agent.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-450 capitalize dark:text-slate-500">
                          <VisibilityIcon className="size-3" />
                          {agent.visibility || "private"}
                        </div>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                      {agent.description || "No description yet."}
                    </p>
                    <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <MessageSquareIcon className="size-3" />
                        {agent.messageCount || 0}
                      </span>
                      {agent.updatedAt ? (
                        <span>
                          {new Date(agent.updatedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Creator resources — these still live in their existing routes */}
        <section className="flex flex-col gap-3 pb-6">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Building blocks
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ResourceCard
              href="/dashboard/connectors/skills"
              title="Skills"
              icon={CpuIcon}
              count={resources.skills}
              loading={loadingResources}
            />
            <ResourceCard
              href="/dashboard/connectors/knowledge"
              title="Knowledge bases"
              icon={BookTextIcon}
              count={resources.kbs}
              loading={loadingResources}
            />
            <ResourceCard
              href="/dashboard/connectors/mcps"
              title="Connectors (MCP)"
              icon={PlugIcon}
              count={resources.mcps}
              loading={loadingResources}
            />
            <ResourceCard
              href="/dashboard/settings/providers"
              title="Model providers"
              icon={SlidersHorizontalIcon}
              count={providers.length}
              loading={loadingResources}
              hint={
                loadingResources ? undefined : `${providers.length} connected`
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
