"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretRightIcon,
  CoinsIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SpanDetail, spanIcon } from "@/components/traces/span-detail";
import { IconTile } from "@/components/traces/message-cards";
import { HitlBanner } from "@/components/traces/hitl-view";
import { TraceInfoDialog } from "@/components/traces/trace-info-dialog";
import {
  VoiceIcon,
  VoicePlayer,
  type Marker,
  type PlayRequest,
} from "@/components/traces/voice-view";
import {
  StatusBadge,
  formatDuration,
  formatTokens,
  isVoiceTrace,
  kindMeta,
  spanAudio,
  type AudioOffset,
  type Span,
  type SubagentRollup,
  type TraceRow,
} from "@/components/traces/trace-utils";
import { cn } from "@/lib/utils";

interface TreeNode {
  span: Span;
  depth: number;
  children: TreeNode[];
}

function buildTree(spans: Span[]): TreeNode[] {
  const ids = new Set(spans.map((s) => s.spanId));
  const childrenOf = new Map<string | null, Span[]>();
  for (const s of spans) {
    const parent = s.parentSpanId && ids.has(s.parentSpanId) ? s.parentSpanId : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(s);
  }
  const build = (parent: string | null, depth: number): TreeNode[] =>
    (childrenOf.get(parent) ?? [])
      .sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt))
      .map((span) => ({ span, depth, children: build(span.spanId, depth + 1) }));
  return build(null, 0);
}

function flatten(nodes: TreeNode[], collapsed: Set<string>, out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (!collapsed.has(n.span.spanId)) flatten(n.children, collapsed, out);
  }
  return out;
}

function TokenPill({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1 py-px font-mono text-[11px] text-muted-foreground">
      <CoinsIcon className="size-3" />
      {formatTokens(n)}
    </span>
  );
}

/** Under a subagent row: its task and what it cost in total. */
function SubagentRowMeta({ span }: { span: Span }) {
  const md = span.metadata ?? {};
  const rollup = md.rollup as SubagentRollup | undefined;
  const description = typeof md.description === "string" ? md.description : null;
  return (
    <>
      {description && <span className="line-clamp-2 text-xs text-muted-foreground">{description}</span>}
      {rollup && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <TokenPill n={rollup.totalTokens} />
          <span className="font-mono">
            {rollup.llmCalls} llm · {rollup.toolCalls} tool
          </span>
          {rollup.errors > 0 && <span className="font-mono text-destructive">· {rollup.errors} err</span>}
        </div>
      )}
    </>
  );
}

function defaultSelection(spans: Span[]): string | null {
  // The first failed step, else the root run.
  const pick =
    spans.find((s) => s.status === "error" && s.kind !== "chain") ??
    spans.find((s) => !s.parentSpanId) ??
    spans[0];
  return pick?.spanId ?? null;
}

/** LangSmith-style trace view: step tree on the left, run inspector on the right. */
export function TraceView({
  trace,
  spans,
  backHref,
  projectId,
  initialSpanId = null,
}: {
  trace: TraceRow;
  spans: Span[];
  backHref: string;
  /** Needed to stream a voice call's recording. */
  projectId?: string;
  initialSpanId?: string | null;
}) {
  const voice = isVoiceTrace(trace) ? trace.metadata?.voice ?? {} : null;
  const [playRequest, setPlayRequest] = React.useState<PlayRequest | null>(null);
  const playSegment = React.useCallback((a: AudioOffset) => {
    if (typeof a.startMs !== "number") return;
    setPlayRequest((prev) => ({ startMs: a.startMs as number, endMs: a.endMs, n: (prev?.n ?? 0) + 1 }));
  }, []);
  const markers = React.useMemo<Marker[]>(
    () =>
      spans
        .filter((s) => s.kind === "chain" && typeof s.metadata?.turn === "number")
        .map((s) => ({ ms: spanAudio(s)?.startMs ?? 0, label: s.name })),
    [spans]
  );
  const [picked, setPicked] = React.useState<string | null>(initialSpanId);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState("");

  const selectedId =
    picked && spans.some((s) => s.spanId === picked) ? picked : defaultSelection(spans);
  const setSelectedId = setPicked;

  const tree = React.useMemo(() => buildTree(spans), [spans]);
  const rows = React.useMemo(() => {
    const all = flatten(tree, collapsed);
    const q = filter.trim().toLowerCase();
    return q ? all.filter((r) => r.span.name.toLowerCase().includes(q)) : all;
  }, [tree, collapsed, filter]);
  const selected = spans.find((s) => s.spanId === selectedId) ?? null;
  const root = spans.find((s) => !s.parentSpanId) ?? null;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const back = (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={backHref} />}>
      <ArrowLeftIcon />
      Traces
    </Button>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      {/* Top bar — one row. Everything else lives in the ⓘ details modal. */}
      <header className="flex min-w-0 items-center gap-2 border-b border-border px-2 py-2 sm:px-3">
        <div className="shrink-0">{back}</div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <IconTile icon={root ? spanIcon(root) : kindMeta("chain").icon} className={kindMeta("chain").tile} />
          <span className="min-w-0 truncate text-sm font-medium" title={trace.agentName || trace.agentId}>
            {trace.agentName || trace.agentId}
          </span>
          <StatusBadge status={trace.status} className="shrink-0" />
          {voice && (
            <Badge variant="outline" className="hidden shrink-0 gap-1 sm:inline-flex">
              <VoiceIcon />
              {voice.telephony ? "Phone call" : "Voice call"}
            </Badge>
          )}
          {trace.truncated && (
            <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
              step limit reached
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* At-a-glance numbers on wider screens; the modal has them all. */}
          <span className="hidden items-center gap-3 font-mono text-xs text-muted-foreground md:flex">
            <span title={voice ? "Call length" : "Latency"}>{formatDuration(trace.durationMs)}</span>
            <span className="inline-flex items-center gap-1" title="Total tokens">
              <CoinsIcon className="size-3.5" />
              {formatTokens(trace.usage?.totalTokens)}
            </span>
          </span>
          {trace.threadId && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="hidden sm:inline-flex"
              render={<Link href={`${backHref}?threadId=${encodeURIComponent(trace.threadId)}`} />}
            >
              View thread
            </Button>
          )}
          <TraceInfoDialog
            trace={trace}
            threadHref={trace.threadId ? `${backHref}?threadId=${encodeURIComponent(trace.threadId)}` : null}
          />
        </div>
      </header>

      <HitlBanner trace={trace} tracesHref={backHref} />

      {voice && projectId && (
        <VoicePlayer
          projectId={projectId}
          traceId={trace._id}
          audio={trace.audio}
          markers={markers}
          request={playRequest}
        />
      )}

      {trace.error && (
        <div className="flex gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{trace.error}</span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Trace tree */}
        <aside className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
            <span className="text-sm font-medium text-muted-foreground">Trace</span>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter runs…"
              className="h-8 font-mono text-xs"
              aria-label="Filter runs"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-3" role="tree" aria-label="Run steps">
            {spans.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">
                {trace.status === "running"
                  ? voice
                    ? "Steps appear every few turns while the call is live."
                    : "Steps appear when the run finishes."
                  : "No steps recorded."}
              </p>
            ) : rows.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">No steps match “{filter}”.</p>
            ) : (
              rows.map(({ span, depth, children }) => {
                const isSelected = span.spanId === selectedId;
                const isCollapsed = collapsed.has(span.spanId);
                const meta = kindMeta(span.kind);
                const isLlm = span.kind === "llm";
                const isEvent = span.kind === "interrupt" || span.kind === "human";
                return (
                  <div
                    key={span.spanId}
                    role="treeitem"
                    aria-selected={isSelected}
                    aria-expanded={children.length ? !isCollapsed : undefined}
                    tabIndex={0}
                    onClick={() => setSelectedId(span.spanId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(span.spanId);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 border-l-2 py-2 pr-2 outline-none hover:bg-muted/50 focus-visible:bg-muted/50",
                      isSelected ? "border-l-blue-500 bg-blue-500/10" : "border-l-transparent"
                    )}
                    style={{ paddingLeft: 12 + Math.min(depth, 8) * 14 }}
                  >
                    <IconTile icon={spanIcon(span)} className={cn(meta.tile, span.status === "error" && "bg-destructive")} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn("truncate text-sm", span.status === "error" && "text-destructive")}>
                          {span.name}
                        </span>
                        {!isLlm && !isEvent && (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {formatDuration(span.durationMs)}
                          </span>
                        )}
                        {span.status === "error" && <WarningCircleIcon className="size-3.5 shrink-0 text-destructive" />}
                      </div>
                      {isLlm && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{formatDuration(span.durationMs)}</span>
                          <TokenPill n={span.usage?.totalTokens} />
                        </div>
                      )}
                      {span.kind === "subagent" && (
                        <SubagentRowMeta span={span} />
                      )}
                      {span.kind === "chain" && typeof span.metadata?.turn === "number" && (
                        <div className="flex">
                          <TokenPill n={span.usage?.totalTokens} />
                        </div>
                      )}
                      {span.metadata?.partial === true && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-400">cut off</span>
                      )}
                    </div>
                    {children.length > 0 && (
                      <button
                        type="button"
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(span.spanId);
                        }}
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                      >
                        {isCollapsed ? <CaretRightIcon className="size-3" /> : <CaretDownIcon className="size-3" />}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Run inspector */}
        <section className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5">
          {selected ? (
            <SpanDetail
              key={selected.spanId}
              span={selected}
              onPlay={voice && trace.audio?.status === "ready" ? playSegment : undefined}
              projectId={projectId}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Select a step to inspect it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
