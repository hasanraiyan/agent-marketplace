"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createProjectAgentVoiceSession } from "@/lib/api/projects";

// Ported from frontend/src/hooks/useVoiceSession.js — drives the Developer
// Studio Agent Test playground's Voice tab. Mints a ticket over ordinary
// HTTP (Clerk + projectAdminAuthMiddleware — see
// createProjectAgentVoiceSession), then owns the WebSocket + Web Audio
// pipeline for the rest of the call.
//
// Wire protocol: binary frames are audio (uplink raw PCM16, no header;
// downlink PCM16 prefixed with a 4-byte little-endian turnSeq so a
// barge-in's `voice_interrupted` event can tell this hook which
// already-buffered frames to drop). Text frames are JSON AG-UI events,
// including six voice-only CUSTOM events this hook understands.

export type VoiceSessionState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

export interface VoiceTranscriptLine {
  id: string;
  speaker: "user" | "agent";
  text: string;
}

export interface VoicePartialTranscript {
  speaker: "user" | "agent";
  text: string;
}

export interface VoiceToolCallSummary {
  id: string;
  name?: string;
  status?: "running" | "done" | "error";
  summary?: string;
}

interface UseVoiceSessionOptions {
  projectId: string;
  agentId: string;
}

// Gemini Live delivers an agent utterance's output transcription as SEVERAL
// incremental fragments (one serverContent message per fragment) inside a
// single model turn — there is no per-fragment "finished" flag; only
// turnComplete closes the turn. The gateway forwards each fragment as its own
// isFinal:true voice_transcript event, so without merging here every fragment
// would render as its own stacked bubble even though the concatenated text is
// one sentence. Fragments arrive as EITHER a cumulative full snapshot OR
// incremental new words (Gemini does both), so handle both:
//   - cumulative: next already contains prev from the start  -> take next
//   - incremental: append next, inserting a space only at a clean word seam
function mergeTranscriptText(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  if (next === prev || prev.endsWith(next)) return prev; // no-op / dup tail
  if (next.startsWith(prev)) return next; // cumulative snapshot
  const needSpace = !/\s$/.test(prev) && !/^\s/.test(next);
  return prev + (needSpace ? " " : "") + next;
}

export function useVoiceSession({ projectId, agentId }: UseVoiceSessionOptions) {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  const [partial, setPartial] = useState<VoicePartialTranscript | null>(null);
  const [toolCalls, setToolCalls] = useState<VoiceToolCallSummary[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const acceptedTurnSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const callStartedAtRef = useRef<number | null>(null);
  // Speaker + turnSeq of the last committed transcript line. Consecutive
  // finals with the same speaker AND turnSeq are fragments of one utterance
  // (the server bumps turnSeq only at turnComplete), so they merge into the
  // line they created instead of spawning a new bubble.
  const lastFinalTurnRef = useRef<{ speaker: string; turnSeq: number } | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (state === "listening" || state === "thinking" || state === "speaking") {
      if (!callStartedAtRef.current) {
        callStartedAtRef.current = Date.now();
      }
      interval = setInterval(() => {
        if (callStartedAtRef.current) {
          setDuration(Math.floor((Date.now() - callStartedAtRef.current) / 1000));
        }
      }, 1000);
    } else if (state === "idle") {
      callStartedAtRef.current = null;
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const teardownAudio = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    }
    streamRef.current = null;

    try {
      recorderNodeRef.current?.disconnect();
    } catch {
      // ignore
    }
    recorderNodeRef.current = null;

    try {
      playerNodeRef.current?.disconnect();
    } catch {
      // ignore
    }
    playerNodeRef.current = null;

    try {
      inputCtxRef.current?.close();
    } catch {
      // ignore
    }
    inputCtxRef.current = null;

    try {
      outputCtxRef.current?.close();
    } catch {
      // ignore
    }
    outputCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    try {
      wsRef.current?.close(1000, "client_stop");
    } catch {
      // ignore
    }
    wsRef.current = null;
    teardownAudio();
    if (mountedRef.current) setState("idle");
  }, [teardownAudio]);

  useEffect(() => stop, [stop]);

  const startCapture = useCallback(async (inputSampleRate: number) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    streamRef.current = stream;

    const inputCtx = new AudioContext({ sampleRate: inputSampleRate });
    if (inputCtx.state === "suspended") {
      await inputCtx.resume();
    }
    inputCtxRef.current = inputCtx;
    await inputCtx.audioWorklet.addModule("/voice/pcm-recorder-worklet.js");

    const source = inputCtx.createMediaStreamSource(stream);
    const recorderNode = new AudioWorkletNode(inputCtx, "pcm-recorder-processor");
    recorderNode.port.onmessage = (event) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(event.data);
      }
    };
    recorderNodeRef.current = recorderNode;
    source.connect(recorderNode);
    // Connect to a zero-gain destination to prevent browser audio graph pruning
    const silence = inputCtx.createGain();
    silence.gain.value = 0;
    recorderNode.connect(silence);
    silence.connect(inputCtx.destination);
  }, []);

  const setupPlayback = useCallback(async (outputSampleRate: number) => {
    const outputCtx = new AudioContext({ sampleRate: outputSampleRate });
    if (outputCtx.state === "suspended") {
      await outputCtx.resume();
    }
    outputCtxRef.current = outputCtx;
    await outputCtx.audioWorklet.addModule("/voice/pcm-player-worklet.js");

    const playerNode = new AudioWorkletNode(outputCtx, "pcm-player-processor");
    playerNode.connect(outputCtx.destination);
    playerNodeRef.current = playerNode;
  }, []);

  const upsertToolCall = useCallback((id: string, patch: Partial<VoiceToolCallSummary>) => {
    setToolCalls((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return [...prev, { id, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const handleTranscript = useCallback(
    (value: { speaker: "user" | "agent"; text: string; isFinal: boolean; turnSeq: number }) => {
      const { speaker, text, isFinal, turnSeq } = value;
      if (!isFinal) {
        setPartial({ speaker, text });
        return;
      }

      // A final may land while a partial of the same speaker is showing (the
      // last interim is superseded by the final) — clear it only for that case.
      setPartial((prev) => (prev?.speaker === speaker ? null : prev));

      const last = lastFinalTurnRef.current;
      const sameUserBurst =
        speaker === "user" && last && last.speaker === speaker && last.turnSeq === turnSeq;

      setTranscript((prev) => {
        const tail = prev[prev.length - 1];
        if (speaker === "user" && tail?.speaker === "user" && tail.text === text) {
          return prev;
        }
        // An agent "answer" can arrive as several separate finals: per-fragment
        // finals of one utterance, or distinct spoken segments split by a tool
        // call mid-answer. Keep them as ONE line while no user line has
        // intervened — this is exactly how the thread reads the same turns back
        // and how text chat shows one assistant message per answer. A committed
        // user line between two agent lines separates answers, so the merge only
        // applies when the open line is also agent.
        const agentContinues = speaker === "agent" && tail?.speaker === "agent";
        if (agentContinues || (sameUserBurst && tail?.speaker === "user")) {
          const merged = mergeTranscriptText(tail.text, text);
          if (merged === tail.text) return prev;
          return prev.map((l, i) => (i === prev.length - 1 ? { ...l, text: merged } : l));
        }
        return [...prev, { id: `${speaker}-${prev.length}`, speaker, text }];
      });
      lastFinalTurnRef.current = { speaker, turnSeq };
    },
    []
  );

  const handleCustomEvent = useCallback(
    (name: string, value: Record<string, unknown>) => {
      switch (name) {
        case "voice_session_ready":
          // Audio graph is built once, right here — after the server
          // confirms setup.
          Promise.all([
            setupPlayback(value.outputSampleRate as number),
            startCapture(value.inputSampleRate as number),
          ])
            .then(() => {
              if (mountedRef.current) setState("listening");
            })
            .catch((err) => {
              if (mountedRef.current) {
                setError(err as Error);
                setState("error");
              }
            });
          break;
        case "voice_activity":
          if (value.speaker === "user" && value.state === "start") {
            setState("listening");
          } else if (value.speaker === "user" && value.state === "end") {
            setState("thinking");
          } else if (value.speaker === "agent" && value.state === "start") {
            setState("speaking");
          } else if (value.speaker === "agent" && value.state === "end") {
            setState("listening");
          }
          break;
        case "voice_transcript":
          handleTranscript(
            value as unknown as { speaker: "user" | "agent"; text: string; isFinal: boolean; turnSeq: number }
          );
          break;
        case "voice_interrupted":
          acceptedTurnSeqRef.current = value.turnSeq as number;
          playerNodeRef.current?.port.postMessage({ type: "flush" });
          break;
        case "voice_session_resumed":
          // Transparent by design — nothing for the UI to do.
          break;
        case "voice_session_ended":
          setState("ended");
          setEndReason((value?.reason as string) || null);
          if (value?.usage && typeof (value.usage as Record<string, unknown>).durationMs === "number") {
            setDuration(Math.round(((value.usage as Record<string, unknown>).durationMs as number) / 1000));
          }
          teardownAudio();
          try {
            wsRef.current?.close();
          } catch {
            // ignore
          }
          wsRef.current = null;
          break;
        default:
          break;
      }
    },
    [handleTranscript, setupPlayback, startCapture, teardownAudio]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        const buf = event.data as ArrayBuffer;
        const view = new DataView(buf);
        const turnSeq = view.getUint32(0, true);
        // The server bumps turnSeq on EVERY new agent utterance (not just
        // on a barge-in) — turn 1 is seq 0, turn 2 is seq 1, and so on.
        // Accepting (and adopting) anything >= the last accepted value
        // handles normal progression automatically; WebSocket delivers
        // messages in send order on one connection, so a voice_interrupted
        // event always arrives before any frame from the new generation it
        // announces — nothing older can arrive after it.
        if (turnSeq >= acceptedTurnSeqRef.current) {
          acceptedTurnSeqRef.current = turnSeq;
          const pcmBytes = buf.slice(4);
          playerNodeRef.current?.port.postMessage(pcmBytes, [pcmBytes]);
        }
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "CUSTOM":
          handleCustomEvent(msg.name as string, (msg.value ?? {}) as Record<string, unknown>);
          break;
        case "TOOL_CALL_CHUNK":
          upsertToolCall(msg.toolCallId as string, {
            name: msg.toolCallName as string,
            status: "running",
          });
          break;
        case "TOOL_CALL_RESULT": {
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(msg.content as string);
          } catch {
            parsed = { output: msg.content };
          }
          upsertToolCall(msg.toolCallId as string, {
            status: parsed?.error ? "error" : "done",
            summary:
              (parsed?.error as string) ||
              (typeof parsed?.output === "string" ? parsed.output : JSON.stringify(parsed?.output ?? "")),
          });
          break;
        }
        case "RUN_ERROR":
          setError(new Error((msg.message as string) || "The agent run failed."));
          setState("error");
          break;
        default:
          break;
      }
    },
    [handleCustomEvent, upsertToolCall]
  );

  const start = useCallback(async () => {
    setError(null);
    setEndReason(null);
    setTranscript([]);
    setPartial(null);
    setToolCalls([]);
    setDuration(0);
    callStartedAtRef.current = null;
    acceptedTurnSeqRef.current = 0;
    setState("connecting");

    try {
      const res = await createProjectAgentVoiceSession(projectId, agentId);
      const { wsUrl } = (res.data?.data || {}) as { wsUrl?: string };
      if (!wsUrl) throw new Error("Server did not return a voice session URL.");

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onmessage = handleMessage;
      ws.onerror = () => {
        if (mountedRef.current) {
          setError(new Error("Voice connection error."));
          setState("error");
        }
      };
      ws.onclose = () => {
        if (mountedRef.current && wsRef.current === ws) {
          setState((prev) => (prev === "error" ? prev : "idle"));
        }
      };
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        setState("error");
      }
      teardownAudio();
    }
  }, [agentId, handleMessage, projectId, teardownAudio]);

  const mute = useCallback((muted: boolean) => {
    setIsMuted(muted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);

  const sendText = useCallback((text: string) => {
    const trimmed = text?.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "voice.text", text: trimmed }));
    setTranscript((prev) => [
      ...prev,
      { id: `user-text-${Date.now()}`, speaker: "user", text: trimmed },
    ]);
  }, []);

  return {
    state,
    duration,
    isMuted,
    transcript,
    partial,
    toolCalls,
    error,
    endReason,
    start,
    stop,
    mute,
    sendText,
  };
}
