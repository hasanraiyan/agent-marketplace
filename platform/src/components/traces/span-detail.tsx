"use client";

import * as React from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  PlayIcon,
  TreeStructureIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonTreeView } from "@/components/chat/tool-cards/json-tree-view";
import { CopyButton } from "@/components/chat/copy-button";
import { IconTile, PayloadView } from "@/components/traces/message-cards";
import { InterruptView, ResumeView } from "@/components/traces/hitl-view";
import { BargeInView, VoiceTokenBreakdown } from "@/components/traces/voice-view";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  formatClock,
  formatDuration,
  formatTokens,
  kindMeta,
  spanAudio,
  type AudioOffset,
  type InterruptKind,
  type InterruptSummary,
  type ResumeSummary,
  type Span,
  type SubagentRollup,
} from "@/components/traces/trace-utils";

export function spanIcon(span: Span) {
  if (span.kind === "chain" && !span.parentSpanId) return TreeStructureIcon;
  return kindMeta(span.kind).icon;
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 self-start text-sm font-medium"
      >
        {open ? <CaretDownIcon className="size-3.5" /> : <CaretRightIcon className="size-3.5" />}
        {title}
      </button>
      {open && children}
    </section>
  );
}

function Attr({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-border py-2 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-mono">{value}</span>
    </div>
  );
}

/**
 * Graph steps receive the whole conversation and their final state repeats
 * it — show only the messages the step added, like LangSmith does.
 */
function newOutputMessages(input: unknown, output: unknown): unknown {
  if (!Array.isArray(input) || !Array.isArray(output) || output.length <= input.length) return output;
  const same = input.every((m, i) => JSON.stringify(m) === JSON.stringify(output[i]));
  return same ? output.slice(input.length) : output;
}

/** A subagent (deepagents `task`): the task it was given, its answer, and its total cost. */
function SubagentRun({ span, projectId }: { span: Span; projectId?: string }) {
  const md = span.metadata ?? {};
  const rollup = md.rollup as SubagentRollup | undefined;
  const description =
    typeof md.description === "string"
      ? md.description
      : typeof (span.input as { description?: unknown })?.description === "string"
        ? String((span.input as { description: string }).description)
        : null;
  return (
    <>
      {rollup && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Tokens", formatTokens(rollup.totalTokens)],
            ["LLM calls", String(rollup.llmCalls)],
            ["Tool calls", String(rollup.toolCalls)],
            ["Failed steps", String(rollup.errors)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className={cn("font-mono text-sm", label === "Failed steps" && rollup.errors > 0 && "text-destructive")}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
      <Collapsible title="Task">
        {description ? (
          <PayloadView value={{ role: "task", content: description, name: md.subagentType ? `→ ${String(md.subagentType)}` : undefined }} projectId={projectId} />
        ) : (
          <PayloadView value={span.input} argsStyle projectId={projectId} />
        )}
      </Collapsible>
      <Collapsible title="Answer">
        {typeof span.output === "string" ? (
          <PayloadView value={{ role: "assistant", content: span.output }} projectId={projectId} />
        ) : (
          <PayloadView value={span.output} projectId={projectId} />
        )}
      </Collapsible>
    </>
  );
}

/** An `interrupt` step stores the pending actions/questions as its input. */
function interruptFromSpan(span: Span): InterruptSummary {
  const kind = ((span.metadata?.interruptKind as InterruptKind) ?? "hitl") as InterruptKind;
  const list = Array.isArray(span.input) ? span.input : [];
  return kind === "clarification"
    ? { kind, questions: list as InterruptSummary["questions"] }
    : { kind, actions: list as InterruptSummary["actions"] };
}

export function SpanDetail({
  span,
  onPlay,
  projectId,
}: {
  span: Span;
  /** Voice traces: play this step's part of the call recording. */
  onPlay?: (offset: AudioOffset) => void;
  projectId?: string;
}) {
  const meta = kindMeta(span.kind);
  const md = span.metadata ?? {};
  const isVoice = Boolean(md.voice);
  const isBargeIn = isVoice && span.kind === "interrupt";
  const audio = spanAudio(span);
  const tools = Array.isArray(md.tools) ? (md.tools as string[]) : null;
  const extra = Object.fromEntries(
    Object.entries(md).filter(([k]) => !["tools", "root", "voice"].includes(k))
  );
  const argsStyle = span.kind === "tool" || span.kind === "subagent";
  const output = span.kind === "chain" ? newOutputMessages(span.input, span.output) : span.output;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile icon={spanIcon(span)} className={meta.tile} />
        <span className="truncate text-base font-medium">{span.name}</span>
        <span className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ID
          <CopyButton text={span.spanId} label="Copy span ID" />
        </span>
        {md.partial === true && (
          <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400">
            cut off
          </Badge>
        )}
        {md.cancelled === true && (
          <Badge variant="outline" className="shrink-0">
            cancelled
          </Badge>
        )}
        <StatusBadge
          status={span.kind === "interrupt" && !isVoice ? "interrupted" : span.status}
          className="ml-auto shrink-0"
        />
      </div>

      {audio && onPlay && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onPlay(audio)}>
            <PlayIcon weight="fill" />
            Play this part
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {formatClock(audio.startMs)}
            {typeof audio.endMs === "number" ? ` – ${formatClock(audio.endMs)}` : ""}
          </span>
        </div>
      )}

      {span.error && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <pre className="whitespace-pre-wrap break-words font-sans">{span.error}</pre>
        </div>
      )}

      <Tabs defaultValue="run" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="flex flex-col gap-6">
          {isVoice && span.usage?.details && (
            <Collapsible title={`Tokens · ${formatTokens(span.usage.totalTokens)}`}>
              <VoiceTokenBreakdown details={span.usage.details} />
            </Collapsible>
          )}
          {isBargeIn ? (
            <BargeInView droppedAgentMs={typeof md.droppedAgentMs === "number" ? md.droppedAgentMs : undefined} />
          ) : isVoice && span.kind === "human" ? (
            <Collapsible title={span.name}>
              <PayloadView value={span.output} projectId={projectId} />
            </Collapsible>
          ) : span.kind === "interrupt" ? (
            <Collapsible title="Waiting for">
              <InterruptView interrupt={interruptFromSpan(span)} />
            </Collapsible>
          ) : span.kind === "subagent" ? (
            <SubagentRun span={span} projectId={projectId} />
          ) : span.kind === "human" ? (
            <>
              <Collapsible title="Asked">
                <InterruptView interrupt={span.input as InterruptSummary | null} />
              </Collapsible>
              <Collapsible title="Answer">
                <ResumeView resume={span.output as ResumeSummary | null} />
              </Collapsible>
            </>
          ) : (
            <>
              <Collapsible title="Input">
                <PayloadView value={span.input} argsStyle={argsStyle} projectId={projectId} />
              </Collapsible>
              <Collapsible title="Output">
                <PayloadView value={output} projectId={projectId} />
              </Collapsible>
            </>
          )}
        </TabsContent>
        <TabsContent value="input">
          <PayloadView value={span.input} argsStyle={argsStyle} projectId={projectId} />
        </TabsContent>
        <TabsContent value="output">
          <PayloadView value={output} projectId={projectId} />
        </TabsContent>

        <TabsContent value="attributes" className="flex flex-col gap-4">
          <div className="rounded-md border border-border px-3">
            <Attr label="Type" value={meta.label} />
            <Attr label="Duration" value={formatDuration(span.durationMs)} />
            <Attr label="Start" value={new Date(span.startedAt).toLocaleString()} />
            {span.endedAt && <Attr label="End" value={new Date(span.endedAt).toLocaleString()} />}
            {span.kind === "llm" && (
              <>
                <Attr
                  label={isVoice ? "Time to first audio" : "Time to first token"}
                  value={formatDuration(span.timeToFirstTokenMs)}
                />
                <Attr label="Model" value={span.model || "—"} />
                <Attr label="Provider" value={span.provider || "—"} />
                <Attr label="Input tokens" value={formatTokens(span.usage?.inputTokens)} />
                <Attr label="Output tokens" value={formatTokens(span.usage?.outputTokens)} />
                <Attr label="Total tokens" value={formatTokens(span.usage?.totalTokens)} />
              </>
            )}
            <Attr label="Span ID" value={span.spanId} />
            {span.parentSpanId && <Attr label="Parent ID" value={span.parentSpanId} />}
          </div>
          {tools && tools.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium">Tools offered ({tools.length})</span>
              <div className="flex flex-wrap gap-1">
                {tools.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {Object.keys(extra).length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium">Metadata</span>
              <JsonTreeView data={extra} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
