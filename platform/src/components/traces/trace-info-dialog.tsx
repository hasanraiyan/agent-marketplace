"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/chat/copy-button";
import { VoiceTokenBreakdown } from "@/components/traces/voice-view";
import {
  StatusBadge,
  endReasonLabel,
  formatDuration,
  formatTokens,
  isVoiceTrace,
  sourceLabel,
  type TraceRow,
} from "@/components/traces/trace-utils";

function Row({ label, value, copy }: { label: string; value: React.ReactNode; copy?: string | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 border-b border-border py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 font-mono">
        <span className="min-w-0 break-words">{value}</span>
        {copy ? <CopyButton text={copy} label={`Copy ${label}`} /> : null}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="rounded-md border border-border px-3">{children}</dl>
    </section>
  );
}

const fullDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : null);

/** The ⓘ button in the trace header: every run / usage / voice detail in one modal. */
export function TraceInfoDialog({ trace, threadHref }: { trace: TraceRow; threadHref?: string | null }) {
  const voice = isVoiceTrace(trace) ? trace.metadata?.voice ?? {} : null;
  const u = trace.usage;
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="icon-sm" aria-label="Trace details" title="Trace details" />}
      >
        <InfoIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {trace.agentName || trace.agentId}
            <StatusBadge status={trace.status} />
          </DialogTitle>
          <DialogDescription>
            {voice ? (voice.telephony ? "Phone call" : "Voice call") : "Agent run"} ·{" "}
            {fullDate(trace.startedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Section title="Run">
            <Row label={voice ? "Call length" : "Latency"} value={formatDuration(trace.durationMs)} />
            <Row label="Started" value={fullDate(trace.startedAt)} />
            <Row label="Ended" value={fullDate(trace.endedAt)} />
            <Row
              label="Source"
              value={`${sourceLabel(trace.source)}${trace.channel && trace.channel !== "web" ? ` · ${trace.channel}` : ""}`}
            />
            <Row label="Model" value={trace.model} />
            <Row label="Provider" value={trace.provider} />
            <Row label="Trace ID" value={trace._id} copy={trace._id} />
            <Row
              label="Thread"
              value={
                trace.threadId && threadHref ? (
                  <Link href={threadHref} className="text-blue-600 hover:underline dark:text-blue-400">
                    {trace.threadId}
                  </Link>
                ) : (
                  trace.threadId
                )
              }
              copy={trace.threadId}
            />
            <Row label="End user" value={trace.endUserId} copy={trace.endUserId} />
          </Section>

          <Section title="Usage">
            <Row label="Total tokens" value={formatTokens(u?.totalTokens)} />
            <Row label="Input tokens" value={formatTokens(u?.inputTokens)} />
            <Row label="Output tokens" value={formatTokens(u?.outputTokens)} />
            <Row label="LLM calls" value={trace.llmCalls ?? 0} />
            <Row
              label="Tool calls"
              value={`${trace.toolCalls ?? 0}${trace.toolErrors ? ` · ${trace.toolErrors} failed` : ""}`}
            />
            {trace.subagentCalls ? <Row label="Subagents" value={trace.subagentCalls} /> : null}
            {trace.truncated ? <Row label="Steps" value="Step limit reached — some steps not recorded" /> : null}
          </Section>

          {u?.details && (
            <section className="flex flex-col gap-1">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tokens by type
              </h3>
              <VoiceTokenBreakdown details={u.details} compact />
            </section>
          )}

          {voice && (
            <Section title="Voice">
              <Row label="Ended by" value={endReasonLabel(voice.endReason)} />
              <Row
                label="Turns"
                value={`${voice.turns ?? 0}${voice.interruptions ? ` · ${voice.interruptions} barge-in` : ""}`}
              />
              {voice.latency?.firstAudioP50Ms != null && (
                <Row
                  label="First audio"
                  value={`p50 ${formatDuration(voice.latency.firstAudioP50Ms)} · p95 ${formatDuration(voice.latency.firstAudioP95Ms)}`}
                />
              )}
              <Row label="Voice" value={voice.voiceName} />
              {voice.reconnects ? <Row label="Reconnects" value={voice.reconnects} /> : null}
              {voice.imagesSent ? <Row label="Images shared" value={voice.imagesSent} /> : null}
              <Row label="Caller" value={voice.telephony?.callerPhone} />
              <Row label="Call SID" value={voice.telephony?.callSid} copy={voice.telephony?.callSid} />
              <Row
                label="Recording"
                value={
                  trace.audio
                    ? trace.audio.status === "ready"
                      ? `Ready · ${formatDuration(trace.audio.durationMs)}${trace.audio.truncated ? " (cut at limit)" : ""}`
                      : trace.audio.status
                    : "Off"
                }
              />
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
