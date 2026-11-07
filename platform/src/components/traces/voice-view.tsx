"use client";

import * as React from "react";
import {
  CircleNotchIcon,
  MicrophoneSlashIcon,
  PauseIcon,
  PhoneIcon,
  PlayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { getProjectTraceAudio } from "@/lib/api/projects";
import {
  errorMessage,
  formatClock,
  formatTokens,
  type TraceAudio,
  type UsageDetails,
} from "@/components/traces/trace-utils";
import { cn } from "@/lib/utils";

export interface PlayRequest {
  startMs: number;
  endMs?: number | null;
  /** Bumped on every request so the same segment can be replayed. */
  n: number;
}

export interface Marker {
  ms: number;
  label: string;
}

type Channel = "both" | "user" | "agent";
const SPEEDS = [1, 1.5, 2];

/**
 * Player for a voice call's recording: a stereo WAV with the user on the
 * left channel and the agent on the right. The file is fetched with the
 * Clerk token on first play (an <audio src> can't send it), then played
 * from an object URL. Web Audio routes the chosen side(s) to both ears.
 */
export function VoicePlayer({
  projectId,
  traceId,
  audio,
  markers,
  request,
}: {
  projectId: string;
  traceId: string;
  audio: TraceAudio | null | undefined;
  markers: Marker[];
  request: PlayRequest | null;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const graph = React.useRef<{ ctx: AudioContext; left: GainNode; right: GainNode } | null>(null);
  const stopAt = React.useRef<number | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState((audio?.durationMs ?? 0) / 1000);
  const [speed, setSpeed] = React.useState(1);
  const [channel, setChannel] = React.useState<Channel>("both");

  React.useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  React.useEffect(() => () => {
    graph.current?.ctx.close().catch(() => {});
  }, []);

  const ensureGraph = React.useCallback(() => {
    const el = audioRef.current;
    if (!el || graph.current || typeof window === "undefined" || !window.AudioContext) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(el);
      const split = ctx.createChannelSplitter(2);
      const merge = ctx.createChannelMerger(2);
      const left = ctx.createGain();
      const right = ctx.createGain();
      src.connect(split);
      split.connect(left, 0);
      split.connect(right, 1);
      for (const g of [left, right]) {
        g.connect(merge, 0, 0);
        g.connect(merge, 0, 1);
      }
      merge.connect(ctx.destination);
      graph.current = { ctx, left, right };
    } catch {
      // Web Audio unavailable — plain stereo playback still works.
    }
  }, []);

  React.useEffect(() => {
    const g = graph.current;
    if (!g) return;
    g.left.gain.value = channel === "agent" ? 0 : channel === "both" ? 0.7 : 1;
    g.right.gain.value = channel === "user" ? 0 : channel === "both" ? 0.7 : 1;
  }, [channel, playing]);

  const load = React.useCallback(async () => {
    if (url) return url;
    setLoading(true);
    setError(null);
    try {
      const res = await getProjectTraceAudio(projectId, traceId);
      const next = URL.createObjectURL(res.data);
      setUrl(next);
      return next;
    } catch (err) {
      setError(errorMessage(err, "Could not load the recording."));
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId, traceId, url]);

  const playFrom = React.useCallback(
    async (startMs?: number, endMs?: number | null) => {
      const src = await load();
      const el = audioRef.current;
      if (!src || !el) return;
      if (el.src !== src) {
        el.src = src;
        await new Promise<void>((resolve) => {
          el.onloadedmetadata = () => resolve();
        });
      }
      ensureGraph();
      await graph.current?.ctx.resume().catch(() => {});
      if (typeof startMs === "number") el.currentTime = Math.max(0, startMs / 1000);
      stopAt.current = typeof endMs === "number" ? endMs / 1000 : null;
      el.playbackRate = speed;
      await el.play().catch(() => {});
    },
    [ensureGraph, load, speed]
  );

  // Play a segment when a step's ▶ is pressed.
  const lastRequest = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!request || request.n === lastRequest.current) return;
    lastRequest.current = request.n;
    void playFrom(request.startMs, request.endMs);
  }, [request, playFrom]);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  if (!audio || audio.status === "none") return null;

  if (audio.status !== "ready") {
    const busy = audio.status === "recording" || audio.status === "processing";
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {busy ? (
          <CircleNotchIcon className="size-4 animate-spin" />
        ) : (
          <MicrophoneSlashIcon className="size-4 text-destructive" />
        )}
        {audio.status === "recording"
          ? "Recording the call — it can be played once the call ends."
          : audio.status === "processing"
            ? "Preparing the recording…"
            : `Recording unavailable${audio.error ? `: ${audio.error}` : ""}`}
      </div>
    );
  }

  const total = duration || (audio.durationMs ?? 0) / 1000;
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-2.5">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || total)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          if (stopAt.current != null && t >= stopAt.current) {
            stopAt.current = null;
            e.currentTarget.pause();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={playing ? "Pause recording" : "Play recording"}
          disabled={loading}
          onClick={() => {
            const el = audioRef.current;
            if (playing && el) el.pause();
            else {
              stopAt.current = null;
              void playFrom();
            }
          }}
        >
          {loading ? (
            <CircleNotchIcon className="animate-spin" />
          ) : playing ? (
            <PauseIcon weight="fill" />
          ) : (
            <PlayIcon weight="fill" />
          )}
        </Button>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatClock(time * 1000)} / {formatClock(total * 1000)}
        </span>
        <div className="relative min-w-[160px] flex-1">
          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={Math.min(time, total || 0)}
            aria-label="Seek recording"
            className="w-full accent-blue-600"
            onChange={(e) => {
              const v = Number(e.target.value);
              setTime(v);
              if (audioRef.current && audioRef.current.src) audioRef.current.currentTime = v;
              else void playFrom(v * 1000);
            }}
          />
          {total > 0 &&
            markers.map((m) => (
              <span
                key={`${m.label}-${m.ms}`}
                title={`${m.label} · ${formatClock(m.ms)}`}
                className="pointer-events-none absolute -top-1 h-1.5 w-px bg-muted-foreground/60"
                style={{ left: `${Math.min(100, (m.ms / 1000 / total) * 100)}%` }}
              />
            ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Which side to hear">
          {(["both", "user", "agent"] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              aria-pressed={channel === c}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[11px] capitalize",
                channel === c
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
          className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Playback speed"
        >
          {speed}×
        </button>
      </div>
      {(error || audio.truncated) && (
        <p className={cn("flex items-center gap-1 text-[11px]", error ? "text-destructive" : "text-muted-foreground")}>
          <WarningCircleIcon className="size-3.5" />
          {error ?? "The call ran past the recording limit, so the end is missing."}
        </p>
      )}
    </div>
  );
}

/** Gemini Live tokens split by type (audio / text / image, in / out). */
export function VoiceTokenBreakdown({ details, compact = false }: { details?: UsageDetails; compact?: boolean }) {
  if (!details) return null;
  const rows: [string, number | undefined][] = [
    ["Audio in", details.input?.audio],
    ["Text in", details.input?.text],
    ["Image in", details.input?.image],
    ["Audio out", details.output?.audio],
    ["Text out", details.output?.text],
    ["Tool results", details.toolUse],
    ["Thinking", details.thoughts],
    ["Cached", details.cached],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {shown.map(([label, v]) => (
        <div key={label} className="flex flex-col rounded-md border border-border px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <span className="font-mono text-sm">{formatTokens(v)}</span>
        </div>
      ))}
    </div>
  );
}

/** A barge-in step: the user talked over the agent. */
export function BargeInView({ droppedAgentMs }: { droppedAgentMs?: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <span className="font-medium">The user started talking over the agent</span>
      <span className="text-xs text-muted-foreground">
        The agent stopped speaking here.
        {droppedAgentMs
          ? ` ${(droppedAgentMs / 1000).toFixed(1)}s of agent audio that hadn't played yet was dropped.`
          : ""}
      </span>
    </div>
  );
}

export function VoiceIcon({ className }: { className?: string }) {
  return <PhoneIcon className={cn("size-3.5", className)} />;
}
