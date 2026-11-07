"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartLineIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  HourglassIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PhoneIcon,
  ProhibitIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getProjectAgents, getProjectTraces } from "@/lib/api/projects";
import {
  StatusBadge,
  errorMessage,
  formatDuration,
  formatTime,
  formatTokens,
  isVoiceTrace,
  sourceLabel,
  type TraceRow,
} from "@/components/traces/trace-utils";
import { TraceUsage } from "@/components/traces/trace-usage";

const PAGE_SIZE = 25;

const RANGES = [
  { value: "1h", label: "Last 1 hour", ms: 60 * 60 * 1000 },
  { value: "24h", label: "Last 1 day", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "All time", ms: 0 },
] as const;

interface AgentOption {
  id: string;
  name: string;
}

function normalizeAgents(raw: unknown): AgentOption[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown[] })?.items)
      ? (raw as { items: unknown[] }).items
      : [];
  return list
    .map((a) => {
      const row = (a ?? {}) as { _id?: string; id?: string; name?: string };
      const id = row._id ?? row.id;
      return id ? { id, name: String(row.name ?? id) } : null;
    })
    .filter((a): a is AgentOption => a !== null);
}

const STATUS_ICON: Record<string, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircleIcon, className: "text-emerald-500" },
  error: { icon: XCircleIcon, className: "text-destructive" },
  running: { icon: CircleNotchIcon, className: "animate-spin text-blue-500" },
  interrupted: { icon: PauseCircleIcon, className: "text-amber-500" },
  cancelled: { icon: ProhibitIcon, className: "text-muted-foreground" },
};

function StatusIcon({ status }: { status: string }) {
  const s = STATUS_ICON[status] ?? STATUS_ICON.cancelled;
  const Icon = s.icon;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex items-center" aria-label={status} />}>
        <Icon weight="fill" className={`size-[18px] ${s.className}`} />
      </TooltipTrigger>
      <TooltipContent className="capitalize">{status}</TooltipContent>
    </Tooltip>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`block truncate ${className}`}>{children}</span>;
}

function TracesPageInner() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "usage" ? "usage" : "runs";
  // Set by a trace's "View thread" link: every run (incl. paused → resumed) of one conversation.
  const threadId = searchParams.get("threadId") ?? "";

  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [agentId, setAgentId] = React.useState(searchParams.get("agentId") ?? "");
  const [status, setStatus] = React.useState("");
  const [source, setSource] = React.useState("");
  const [channel, setChannel] = React.useState(searchParams.get("channel") ?? "");
  const [range, setRange] = React.useState<string>("24h");
  const [page, setPage] = React.useState(1);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [rows, setRows] = React.useState<TraceRow[] | null>(null);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; error: string | null } | null>(null);
  const requestKey = [projectId, page, agentId, status, source, channel, range, threadId, reloadKey].join("|");
  const loading = result?.key !== requestKey;
  const error = loading ? null : (result?.error ?? null);

  React.useEffect(() => {
    getProjectAgents(projectId)
      .then((res) => setAgents(normalizeAgents(res.data?.data)))
      .catch(() => setAgents([]));
  }, [projectId]);

  React.useEffect(() => {
    if (tab !== "runs") return;
    let cancelled = false;
    // A thread view shows the whole conversation regardless of the time range.
    const span = threadId ? 0 : (RANGES.find((r) => r.value === range)?.ms ?? 0);
    getProjectTraces(projectId, {
      page,
      limit: PAGE_SIZE,
      agentId: agentId || undefined,
      status: status || undefined,
      source: source || undefined,
      channel: channel || undefined,
      threadId: threadId || undefined,
      from: span ? new Date(Date.now() - span).toISOString() : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setRows(data?.items ?? []);
        setPages(data?.pagination?.pages || 1);
        setTotal(data?.pagination?.total || 0);
        setResult({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setResult({ key: requestKey, error: errorMessage(err, "Failed to load traces.") });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, tab, page, agentId, status, source, channel, range, threadId, reloadKey, requestKey]);

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "usage") params.set("tab", "usage");
    else params.delete("tab");
    router.replace(`?${params.toString()}`);
  };

  const traceHref = (id: string) => `/projects/${projectId}/traces/${id}`;
  const clearThread = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("threadId");
    setPage(1);
    router.replace(`?${params.toString()}`);
  };
  const onFilter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-base font-medium">
          <ChartLineIcon className="size-4 text-muted-foreground" />
          Traces
        </h1>
        <p className="text-xs text-muted-foreground">
          Every agent run and voice call, step by step — LLM calls, tool calls, subagents, tokens and latency.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="runs">Traces</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          {tab === "runs" && threadId && (
            <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
              Thread <span className="max-w-[140px] truncate font-mono">{threadId}</span>
              <button
                type="button"
                onClick={clearThread}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear thread filter"
              >
                ×
              </button>
            </span>
          )}

          {tab === "runs" && !threadId && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <HourglassIcon className="size-4" />
              <NativeSelect size="sm" value={range} onChange={onFilter(setRange)} aria-label="Time range">
                {RANGES.map((r) => (
                  <NativeSelectOption key={r.value} value={r.value}>
                    {r.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}

          <NativeSelect size="sm" value={agentId} onChange={onFilter(setAgentId)} aria-label="Filter by agent">
            <NativeSelectOption value="">All agents</NativeSelectOption>
            {agents.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {tab === "runs" && (
            <>
              <NativeSelect size="sm" value={status} onChange={onFilter(setStatus)} aria-label="Filter by status">
                <NativeSelectOption value="">Any status</NativeSelectOption>
                <NativeSelectOption value="success">Success</NativeSelectOption>
                <NativeSelectOption value="error">Error</NativeSelectOption>
                <NativeSelectOption value="interrupted">Interrupted</NativeSelectOption>
                <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
                <NativeSelectOption value="running">Running</NativeSelectOption>
              </NativeSelect>
              <NativeSelect size="sm" value={source} onChange={onFilter(setSource)} aria-label="Filter by source">
                <NativeSelectOption value="">Any source</NativeSelectOption>
                <NativeSelectOption value="api">API</NativeSelectOption>
                <NativeSelectOption value="playground">Playground</NativeSelectOption>
                <NativeSelectOption value="architect">Architect</NativeSelectOption>
              </NativeSelect>
              <NativeSelect size="sm" value={channel} onChange={onFilter(setChannel)} aria-label="Filter by channel">
                <NativeSelectOption value="">Any channel</NativeSelectOption>
                <NativeSelectOption value="web">Text chat</NativeSelectOption>
                <NativeSelectOption value="voice">Voice calls</NativeSelectOption>
              </NativeSelect>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {loading && !rows ? "…" : `${total.toLocaleString()} traces`}
                </span>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh">
                  <ArrowClockwiseIcon className={loading && rows ? "animate-spin" : undefined} />
                </Button>
              </div>
            </>
          )}
        </div>

        <TabsContent value="runs">
          {loading && !rows ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : rows && rows.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto rounded-md border border-border sm:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead className="w-[16%]">Name</TableHead>
                      <TableHead className="w-[24%]">Input</TableHead>
                      <TableHead className="w-[24%]">Output</TableHead>
                      <TableHead className="hidden w-[14%] xl:table-cell">Error</TableHead>
                      <TableHead className="w-28">Start time</TableHead>
                      <TableHead className="w-20 text-right">Latency</TableHead>
                      <TableHead className="w-20 text-right">Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => (
                      <TableRow key={t._id} className="cursor-pointer" onClick={() => router.push(traceHref(t._id))}>
                        <TableCell>
                          <StatusIcon status={t.status} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={traceHref(t._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {t.agentName || t.agentId}
                          </Link>
                          <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
                            {isVoiceTrace(t) && <PhoneIcon className="size-3 shrink-0" aria-label="Voice call" />}
                            {sourceLabel(t.source)}
                            {t.channel && t.channel !== "web" ? ` · ${t.channel}` : ""}
                            {t.audio?.status === "ready" && (
                              <MicrophoneIcon
                                className="size-3 shrink-0 text-blue-600 dark:text-blue-400"
                                aria-label="Recording available"
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Cell>
                            {t.resume ? (
                              <span className="text-sky-700 dark:text-sky-400">↩ {t.resume.summary || "Resumed"}</span>
                            ) : (
                              <>
                                <span className="text-muted-foreground">user: </span>
                                {t.input || "—"}
                              </>
                            )}
                          </Cell>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Cell>
                            {t.status === "interrupted" && t.interrupt ? (
                              <span className="text-amber-700 dark:text-amber-400">
                                ⏸ {t.interrupt.summary || t.interrupt.title || "Paused"}
                              </span>
                            ) : t.output ? (
                              <>
                                <span className="text-muted-foreground">ai: </span>
                                {t.output}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </Cell>
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          <Cell className="text-destructive">{t.error || ""}</Cell>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatTime(t.startedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                          {formatDuration(t.durationMs)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                          {formatTokens(t.usage?.totalTokens)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2 sm:hidden">
                {rows.map((t) => (
                  <Link
                    key={t._id}
                    href={traceHref(t._id)}
                    className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate text-sm font-medium">
                        {isVoiceTrace(t) && (
                          <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Voice call" />
                        )}
                        {t.agentName || t.agentId}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <span className="line-clamp-2 text-xs">{t.input || "—"}</span>
                    {t.output && <span className="line-clamp-2 text-xs text-muted-foreground">ai: {t.output}</span>}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatTime(t.startedAt)} · {formatDuration(t.durationMs)} · {formatTokens(t.usage?.totalTokens)} tok
                    </span>
                  </Link>
                ))}
              </div>

              {pages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <CaretLeftIcon />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {pages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                    <CaretRightIcon />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty className="border border-dashed border-border py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChartLineIcon />
                </EmptyMedia>
                <EmptyTitle>No runs in this range</EmptyTitle>
                <EmptyDescription>
                  Chat with an agent in the Playground or call it through the API — each run shows up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="usage">
          {tab === "usage" && <TraceUsage projectId={projectId} agentId={agentId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TracesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <TracesPageInner />
    </React.Suspense>
  );
}
