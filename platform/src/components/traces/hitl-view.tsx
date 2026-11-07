"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowBendDownRightIcon,
  ArrowBendUpLeftIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  HandPalmIcon,
  PencilSimpleIcon,
  WrenchIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { JsonTreeView } from "@/components/chat/tool-cards/json-tree-view";
import { IconTile } from "@/components/traces/message-cards";
import type { InterruptSummary, ResumeSummary, TraceRow } from "@/components/traces/trace-utils";
import { cn } from "@/lib/utils";

function Args({ value }: { value: unknown }) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-xs text-muted-foreground">No arguments</span>;
    return (
      <ul className="flex flex-col gap-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex min-w-0 items-start gap-2 text-sm">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <span className="shrink-0 text-muted-foreground">{k}</span>
            {v !== null && typeof v === "object" ? (
              <JsonTreeView data={v} className="min-w-0" />
            ) : (
              <span className="min-w-0 break-words">{String(v)}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (value === null || value === undefined) return null;
  return <JsonTreeView data={value} />;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 rounded-md border border-border bg-card p-3", className)}>{children}</div>;
}

/** What the run is waiting on — pending tool approvals, questions, or client tools. */
export function InterruptView({ interrupt }: { interrupt: InterruptSummary | null | undefined }) {
  if (!interrupt) return <p className="text-xs text-muted-foreground">—</p>;
  if (interrupt.kind === "clarification") {
    return (
      <div className="flex flex-col gap-2">
        {(interrupt.questions ?? []).map((q, i) => (
          <Card key={q.id ?? i}>
            <div className="flex items-center gap-2">
              <IconTile icon={ChatCircleDotsIcon} className="bg-amber-500" size="sm" />
              <span className="text-sm">{q.text}</span>
            </div>
            {q.options && q.options.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-7">
                {q.options.map((o) => (
                  <Badge key={o} variant="secondary">
                    {o}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {(interrupt.actions ?? []).map((a, i) => (
        <Card key={`${a.name}-${i}`}>
          <div className="flex items-center gap-2">
            <IconTile icon={WrenchIcon} className="bg-emerald-600" size="sm" />
            <span className="text-sm font-medium">{a.name}</span>
            {interrupt.kind === "frontend_tool" && (
              <Badge variant="outline" className="text-[10px]">
                runs in the browser
              </Badge>
            )}
          </div>
          <div className="pl-7">
            <Args value={a.args} />
          </div>
          {a.allowedDecisions && a.allowedDecisions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pl-7">
              <span className="text-[11px] text-muted-foreground">Allowed:</span>
              {a.allowedDecisions.map((d) => (
                <Badge key={d} variant="outline" className="text-[10px] capitalize">
                  {d}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

const DECISION: Record<string, { icon: React.ElementType; tile: string; label: string }> = {
  approve: { icon: CheckIcon, tile: "bg-emerald-600", label: "Approved" },
  reject: { icon: XIcon, tile: "bg-destructive", label: "Rejected" },
  edit: { icon: PencilSimpleIcon, tile: "bg-sky-500", label: "Edited" },
};

/** The person's answer that resumed the run. */
export function ResumeView({ resume }: { resume: ResumeSummary | null | undefined }) {
  if (!resume) return <p className="text-xs text-muted-foreground">—</p>;

  if (resume.kind === "hitl") {
    return (
      <div className="flex flex-col gap-2">
        {(resume.decisions ?? []).map((d, i) => {
          const meta = DECISION[d.type] ?? { icon: CheckIcon, tile: "bg-zinc-500", label: d.type };
          return (
            <Card key={i}>
              <div className="flex items-center gap-2">
                <IconTile icon={meta.icon} className={meta.tile} size="sm" />
                <span className="text-sm font-medium">{meta.label}</span>
                <span className="font-mono text-sm">{d.action}</span>
              </div>
              {d.message && <p className="pl-7 text-sm text-muted-foreground">“{d.message}”</p>}
              {d.editedArgs != null && (
                <div className="flex flex-col gap-1 pl-7">
                  <span className="text-[11px] text-muted-foreground">New arguments</span>
                  <Args value={d.editedArgs} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  if (resume.kind === "frontend_tool") {
    return (
      <div className="flex flex-col gap-2">
        {(resume.results ?? []).map((r, i) => (
          <Card key={r.toolCallId ?? i}>
            <div className="flex items-center gap-2">
              <IconTile icon={r.error ? XIcon : CheckIcon} className={r.error ? "bg-destructive" : "bg-emerald-600"} size="sm" />
              <span className="font-mono text-sm">{r.name}</span>
            </div>
            <div className="pl-7">
              {r.error ? <p className="text-sm text-destructive">{r.error}</p> : <Args value={r.result} />}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      {resume.text && <p className="whitespace-pre-wrap text-sm">{resume.text}</p>}
      {resume.answers != null && <JsonTreeView data={resume.answers} />}
      {!resume.text && resume.answers == null && <p className="text-sm">{resume.summary}</p>}
    </Card>
  );
}

/** Banner under the trace header linking a paused run and the run that resumed it. */
export function HitlBanner({ trace, tracesHref }: { trace: TraceRow; tracesHref: string }) {
  if (!trace.interrupt && !trace.resume) return null;
  return (
    <div className="flex flex-col divide-y divide-border border-b border-border">
      {trace.resume && (
        <div className="flex flex-wrap items-center gap-2 bg-sky-500/5 px-4 py-2 text-xs">
          <ArrowBendUpLeftIcon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="font-medium">Resumed after human input:</span>
          <span className="min-w-0 truncate">{trace.resume.summary}</span>
          {trace.resumedFromTraceId && (
            <Link href={`${tracesHref}/${trace.resumedFromTraceId}`} className="ml-auto shrink-0 text-sky-700 hover:underline dark:text-sky-400">
              ← Paused run
            </Link>
          )}
        </div>
      )}
      {trace.interrupt && (
        <div className="flex flex-wrap items-center gap-2 bg-amber-500/5 px-4 py-2 text-xs">
          <HandPalmIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium">{trace.interrupt.title ?? "Paused"}:</span>
          <span className="min-w-0 truncate">{trace.interrupt.summary}</span>
          {trace.resumedByTraceId ? (
            <Link href={`${tracesHref}/${trace.resumedByTraceId}`} className="ml-auto flex shrink-0 items-center gap-1 text-amber-700 hover:underline dark:text-amber-400">
              Resumed run
              <ArrowBendDownRightIcon className="size-3.5" />
            </Link>
          ) : (
            <span className="ml-auto shrink-0 text-muted-foreground">Still waiting for a response</span>
          )}
        </div>
      )}
    </div>
  );
}
