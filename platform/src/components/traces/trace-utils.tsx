"use client";

import * as React from "react";
import {
  BrainIcon,
  BookOpenIcon,
  CircleNotchIcon,
  HandPalmIcon,
  LinkSimpleIcon,
  UserCheckIcon,
  RobotIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TraceStatus = "running" | "success" | "error" | "interrupted" | "cancelled";
export type SpanKind = "llm" | "tool" | "subagent" | "retriever" | "chain" | "interrupt" | "human";

export interface UsageDetails {
  input?: { audio?: number; text?: number; image?: number; video?: number };
  output?: { audio?: number; text?: number };
  toolUse?: number;
  thoughts?: number;
  cached?: number;
  responses?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Voice calls: Gemini Live tokens broken down by type. */
  details?: UsageDetails;
}

export interface TraceAudio {
  status: "recording" | "processing" | "ready" | "failed" | "none";
  storageKey?: string;
  mimeType?: string;
  durationMs?: number;
  bytes?: number;
  sampleRate?: number;
  channels?: { left: string; right: string };
  truncated?: boolean;
  error?: string;
}

export interface VoiceMeta {
  voiceName?: string | null;
  endReason?: string | null;
  durationMs?: number;
  turns?: number;
  interruptions?: number;
  reconnects?: number;
  imagesSent?: number;
  droppedAgentMs?: number;
  latency?: { firstAudioP50Ms?: number | null; firstAudioP95Ms?: number | null };
  telephony?: { callSid?: string | null; callerPhone?: string | null; channel?: string };
}

/** Where a voice step sits in the call recording (ms on the call timeline). */
export interface AudioOffset {
  startMs?: number | null;
  endMs?: number | null;
}

export function isVoiceTrace(trace?: { metadata?: { voice?: unknown } | null } | null) {
  return Boolean(trace?.metadata?.voice);
}

export function spanAudio(span: Span): AudioOffset | null {
  const a = span.metadata?.audio as AudioOffset | undefined;
  return a && typeof a.startMs === "number" ? a : null;
}

const END_REASON: Record<string, string> = {
  agent_ended: "Agent ended",
  client_closed: "Caller hung up",
  idle: "Idle timeout",
  max_duration: "Max duration",
  upstream_error: "Gemini error",
};

export function endReasonLabel(reason?: string | null) {
  return reason ? END_REASON[reason] ?? reason : "—";
}

export function formatClock(ms?: number | null) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export interface TraceRow {
  _id: string;
  agentId: string;
  agentName?: string | null;
  threadId?: string | null;
  source: "playground" | "api" | "architect" | string;
  channel?: string;
  endUserId?: string | null;
  status: TraceStatus;
  model?: string | null;
  provider?: string | null;
  input?: string | null;
  output?: string | null;
  error?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  usage?: Usage;
  llmCalls?: number;
  toolCalls?: number;
  toolErrors?: number;
  subagentCalls?: number;
  spanCount?: number;
  truncated?: boolean;
  /** Why this run paused (status "interrupted"). */
  interrupt?: InterruptSummary | null;
  /** The human answer that started this (resumed) run. */
  resume?: ResumeSummary | null;
  resumedFromTraceId?: string | null;
  resumedByTraceId?: string | null;
  /** Voice calls only. */
  audio?: TraceAudio | null;
  metadata?: { voice?: VoiceMeta } | null;
}

export interface Span {
  _id?: string;
  spanId: string;
  parentSpanId: string | null;
  kind: SpanKind;
  name: string;
  status: "running" | "success" | "error";
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  timeToFirstTokenMs?: number | null;
  model?: string | null;
  provider?: string | null;
  usage?: Usage;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export type InterruptKind = "hitl" | "clarification" | "frontend_tool";

export interface SubagentRollup {
  llmCalls: number;
  toolCalls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface InterruptSummary {
  kind: InterruptKind;
  title?: string;
  summary?: string;
  actions?: { name: string; args?: unknown; description?: string; allowedDecisions?: string[] | null; toolCallId?: string | null }[];
  questions?: { id?: string; text: string; options?: string[] }[];
}

export interface ResumeSummary {
  kind: InterruptKind;
  summary?: string;
  decisions?: { action: string; type: string; message?: string | null; editedArgs?: unknown }[];
  answers?: unknown;
  text?: string | null;
  results?: { name: string; toolCallId?: string | null; result?: unknown; error?: string | null }[];
}

export function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function formatTokens(n?: number | null): string {
  if (!n) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  success: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  error: "border-destructive/50 text-destructive",
  running: "border-blue-500/40 text-blue-700 dark:text-blue-400",
  interrupted: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  cancelled: "border-border text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 capitalize", STATUS_STYLE[status], className)}>
      {status === "running" && <CircleNotchIcon className="size-3 animate-spin" />}
      {status === "interrupted" ? "paused" : status}
    </Badge>
  );
}

const KIND_META: Record<
  SpanKind,
  { icon: React.ElementType; label: string; bar: string; text: string; tile: string }
> = {
  llm: { icon: BrainIcon, label: "LLM", bar: "bg-orange-500/70", text: "text-orange-600 dark:text-orange-400", tile: "bg-orange-500" },
  tool: { icon: WrenchIcon, label: "Tool", bar: "bg-emerald-500/70", text: "text-emerald-600 dark:text-emerald-400", tile: "bg-emerald-600" },
  subagent: { icon: RobotIcon, label: "Subagent", bar: "bg-violet-500/70", text: "text-violet-600 dark:text-violet-400", tile: "bg-violet-500" },
  retriever: { icon: BookOpenIcon, label: "Retriever", bar: "bg-teal-500/70", text: "text-teal-600 dark:text-teal-400", tile: "bg-teal-600" },
  chain: { icon: LinkSimpleIcon, label: "Chain", bar: "bg-blue-500/60", text: "text-blue-600 dark:text-blue-400", tile: "bg-blue-500" },
  interrupt: { icon: HandPalmIcon, label: "Paused", bar: "bg-amber-500/70", text: "text-amber-600 dark:text-amber-400", tile: "bg-amber-500" },
  human: { icon: UserCheckIcon, label: "Human", bar: "bg-sky-500/70", text: "text-sky-600 dark:text-sky-400", tile: "bg-sky-500" },
};

export function kindMeta(kind: string) {
  return KIND_META[kind as SpanKind] ?? KIND_META.chain;
}

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const meta = kindMeta(kind);
  const Icon = meta.icon;
  return <Icon className={cn("size-3.5 shrink-0", meta.text, className)} />;
}

export function sourceLabel(source?: string) {
  switch (source) {
    case "playground":
      return "Playground";
    case "api":
      return "API";
    case "architect":
      return "Architect";
    default:
      return source || "—";
  }
}

export function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
  );
}
