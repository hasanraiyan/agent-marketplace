"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import { recorderWorkletUrl, playerWorkletUrl } from "./voiceWorklets.js";
import type {
  PersonaVoiceEndReason,
  PersonaVoiceState,
  PersonaVoiceToolCall,
  PersonaVoiceTranscriptLine,
  UseVoiceOptions,
  UseVoiceResult,
} from "../types.js";

interface VoiceSessionTicket {
  ticket: string;
  wsUrl: string;
  expiresAt: string;
  session: {
    model: string;
    voice: string;
    inputSampleRate: number;
    outputSampleRate: number;
    maxDurationMs: number;
  };
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

interface VoiceTranscriptValue {
  speaker: "user" | "agent";
  text: string;
  isFinal: boolean;
  turnSeq?: number;
}

/**
 * Drives a real-time voice call with an Agent (powered by Gemini Live).
 *
 * Ticket minting goes through YOUR OWN backend (`POST /voice/sessions` on
 * whichever `@personaai/runtime`-based adapter you've mounted) via
 * `fetchWithAuth` — same as every other hook in this package. The actual
 * call does NOT: once a ticket comes back, this hook opens a WebSocket
 * DIRECTLY to Persona (`ticket.wsUrl`), bypassing your backend entirely for
 * the live audio. This is deliberate — see the package README's Voice
 * section for why (short version: a multi-minute relay would not survive
 * on a serverless deployment the way `POST /chat`'s bounded SSE relay
 * does), and it means your backend never has to become a WebSocket relay.
 *
 * Requires a browser with `AudioWorklet` support (all current evergreen
 * browsers). The processor code itself needs no `/public` file of your
 * own — it's embedded and loaded via a Blob URL (see `voiceWorklets.ts`).
 */
export function useVoice(options: UseVoiceOptions = {}): UseVoiceResult {
  const { defaultAgentId, fetchWithAuth, logger } = usePersonaContext();
  const voiceLogger = useMemo(() => logger.child("voice"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;

  const [state, setState] = useState<PersonaVoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<PersonaVoiceTranscriptLine[]>(
    [],
  );
  const [partial, setPartial] = useState<PersonaVoiceTranscriptLine | null>(
    null,
  );
  const [toolCalls, setToolCalls] = useState<PersonaVoiceToolCall[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [endReason, setEndReason] = useState<PersonaVoiceEndReason | null>(
    null,
  );

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const acceptedTurnSeqRef = useRef(0);
  const mountedRef = useRef(true);
  // Speaker + turnSeq of the last committed transcript line. Consecutive
  // finals with the same speaker AND turnSeq are fragments of one utterance
  // (the server bumps turnSeq only at turnComplete), so they merge into the
  // line they created instead of spawning a new bubble.
  const lastFinalTurnRef = useRef<{ speaker: string; turnSeq?: number } | null>(
    null,
  );

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
      void inputCtxRef.current?.close();
    } catch {
      // ignore
    }
    inputCtxRef.current = null;

    try {
      void outputCtxRef.current?.close();
    } catch {
      // ignore
    }
    outputCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    voiceLogger.debug("stop() called");
    try {
      wsRef.current?.close(1000, "client_stop");
    } catch {
      // ignore
    }
    wsRef.current = null;
    teardownAudio();
    if (mountedRef.current) setState("idle");
  }, [teardownAudio, voiceLogger]);

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
    inputCtxRef.current = inputCtx;
    await inputCtx.audioWorklet.addModule(recorderWorkletUrl());

    const source = inputCtx.createMediaStreamSource(stream);
    const recorderNode = new AudioWorkletNode(
      inputCtx,
      "pcm-recorder-processor",
    );
    recorderNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(event.data);
      }
    };
    recorderNodeRef.current = recorderNode;
    source.connect(recorderNode);
  }, []);

  const setupPlayback = useCallback(async (outputSampleRate: number) => {
    const outputCtx = new AudioContext({ sampleRate: outputSampleRate });
    outputCtxRef.current = outputCtx;
    await outputCtx.audioWorklet.addModule(playerWorkletUrl());

    const playerNode = new AudioWorkletNode(outputCtx, "pcm-player-processor");
    playerNode.connect(outputCtx.destination);
    playerNodeRef.current = playerNode;
  }, []);

  const upsertToolCall = useCallback(
    (id: string, patch: Partial<PersonaVoiceToolCall>) => {
      setToolCalls((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return [...prev, { id, status: "running", ...patch }];
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch } as PersonaVoiceToolCall;
        return next;
      });
    },
    [],
  );

  const handleTranscript = useCallback((value: VoiceTranscriptValue) => {
    const { speaker, text, isFinal, turnSeq } = value;
    if (!isFinal) {
      setPartial({ id: "partial", speaker, text });
      return;
    }

    // A final may land while a partial of the same speaker is showing (the
    // last interim is superseded by the final) — clear it only for that case.
    setPartial((prev) => (prev?.speaker === speaker ? null : prev));

    const last = lastFinalTurnRef.current;
    const sameUtterance =
      last &&
      last.speaker === speaker &&
      last.turnSeq === turnSeq;

    setTranscript((prev) => {
      const tail = prev[prev.length - 1];
      // Same speaker + same turn => fragment of the utterance still streaming
      // in. Merge into the open line (which already rendered as a bubble)
      // rather than appending a second bubble for this fragment.
      if (sameUtterance && tail?.speaker === speaker) {
        const merged = mergeTranscriptText(tail.text, text);
        if (merged === tail.text) return prev;
        return prev.map((l, i) =>
          i === prev.length - 1 ? { ...l, text: merged } : l,
        );
      }
      return [...prev, { id: `${speaker}-${prev.length}`, speaker, text }];
    });
    lastFinalTurnRef.current = { speaker, turnSeq };
  }, []);

  const handleCustomEvent = useCallback(
    (name: string, value: Record<string, unknown>) => {
      switch (name) {
        case "voice_session_ready":
          voiceLogger.debug("voice_session_ready", value);
          Promise.all([
            setupPlayback(value.outputSampleRate as number),
            startCapture(value.inputSampleRate as number),
          ])
            .then(() => {
              if (mountedRef.current) setState("listening");
            })
            .catch((err) => {
              voiceLogger.error("audio graph setup failed", {
                error: err instanceof Error ? err.message : String(err),
              });
              if (mountedRef.current) {
                setError(err instanceof Error ? err : new Error(String(err)));
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
          handleTranscript(value as unknown as VoiceTranscriptValue);
          break;
        case "voice_interrupted":
          acceptedTurnSeqRef.current = value.turnSeq as number;
          playerNodeRef.current?.port.postMessage({ type: "flush" });
          break;
        case "voice_session_resumed":
          voiceLogger.info("session transparently resumed");
          break;
        case "voice_session_ended":
          voiceLogger.info("session ended", { reason: value.reason });
          setState("ended");
          setEndReason((value.reason as PersonaVoiceEndReason) ?? null);
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
    [handleTranscript, setupPlayback, startCapture, teardownAudio, voiceLogger],
  );

  const handleMessage = useCallback(
    (event: MessageEvent<ArrayBuffer | string>) => {
      if (typeof event.data !== "string") {
        const buf = event.data;
        const view = new DataView(buf);
        const turnSeq = view.getUint32(0, true);
        // Accept (and adopt) anything >= the last accepted value rather
        // than an exact match — the server bumps turnSeq on EVERY new
        // agent turn, not only on a barge-in. WebSocket delivers messages
        // in send order on one connection, so a voice_interrupted event
        // always arrives before any frame from the generation it
        // announces — nothing stale can arrive after it.
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
          handleCustomEvent(
            msg.name as string,
            msg.value as Record<string, unknown>,
          );
          break;
        case "TOOL_CALL_CHUNK":
          upsertToolCall(msg.toolCallId as string, {
            name: msg.toolCallName as string | undefined,
            status: "running",
          });
          break;
        case "TOOL_CALL_RESULT": {
          let parsed: { output?: unknown; error?: string } | null = null;
          try {
            parsed = JSON.parse(msg.content as string);
          } catch {
            parsed = { output: msg.content };
          }
          upsertToolCall(msg.toolCallId as string, {
            status: parsed?.error ? "error" : "done",
            summary:
              parsed?.error ||
              (typeof parsed?.output === "string"
                ? parsed.output
                : JSON.stringify(parsed?.output ?? "")),
          });
          break;
        }
        case "RUN_ERROR":
          voiceLogger.warn("RUN_ERROR", { message: msg.message });
          setError(
            new Error((msg.message as string) || "The agent run failed."),
          );
          setState("error");
          break;
        default:
          break;
      }
    },
    [handleCustomEvent, upsertToolCall, voiceLogger],
  );

  const start = useCallback(async () => {
    if (!agentId) {
      const err = new Error(
        "useVoice: no agentId provided and no defaultAgentId set on PersonaProvider",
      );
      setError(err);
      setState("error");
      return;
    }

    setError(null);
    setEndReason(null);
    setTranscript([]);
    setPartial(null);
    setToolCalls([]);
    acceptedTurnSeqRef.current = 0;
    setState("connecting");
    voiceLogger.debug("start() called", { agentId, threadId });

    try {
      const res = await fetchWithAuth("/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          ...(threadId ? { threadId } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to start voice session: ${res.statusText}`);
      }
      const data = await res.json();
      const ticket = (data?.data ?? data) as VoiceSessionTicket;
      if (!ticket?.wsUrl) {
        throw new Error("Server did not return a voice session URL.");
      }

      const ws = new WebSocket(ticket.wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onmessage = handleMessage;
      ws.onerror = () => {
        voiceLogger.warn("WebSocket error");
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
      const errorObj = err instanceof Error ? err : new Error(String(err));
      voiceLogger.error("start() failed", { error: errorObj.message });
      if (mountedRef.current) {
        setError(errorObj);
        setState("error");
      }
      teardownAudio();
    }
  }, [agentId, threadId, fetchWithAuth, handleMessage, teardownAudio, voiceLogger]);

  const mute = useCallback((muted: boolean) => {
    setIsMuted(muted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);

  const sendText = useCallback((text: string) => {
    if (!text?.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "voice.text", text }));
  }, []);

  return {
    state,
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
