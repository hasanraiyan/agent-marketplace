"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createProjectAgentVoiceSession } from "@/lib/api/projects";

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
function mergeTranscriptText(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (next === prev || prev.endsWith(next)) return prev; // no-op / dup tail
  if (next.startsWith(prev)) return next; // cumulative snapshot
  const needSpace = !/\s$/.test(prev) && !/^\s/.test(next);
  return prev + (needSpace ? " " : "") + next;
}

/**
 * Drives the Developer Studio Agent Test playground's Voice tab
 * (voice-agent-plan.md §13.1, §14). Mints a ticket over ordinary HTTP
 * (Clerk + projectAdminAuthMiddleware — see createProjectAgentVoiceSession),
 * then owns the WebSocket + Web Audio pipeline for the rest of the call.
 *
 * Wire protocol (voice-agent-plan.md §5): binary frames are audio (uplink
 * raw PCM16, no header; downlink PCM16 prefixed with a 4-byte little-endian
 * turnSeq so a barge-in's `voice_interrupted` event can tell this hook
 * which already-buffered frames to drop). Text frames are JSON AG-UI
 * events, including six voice-only CUSTOM events this hook understands.
 *
 * Deliberately NOT the general-purpose `useVoice()` this plan's SDK phase
 * (§14) will eventually ship — this is purpose-built for one Project's one
 * Agent inside this one page, with no thread persistence (Phase 1 has none
 * yet) and no reusable public API surface.
 */
export function useVoiceSession({ projectId, agentId }) {
  const [state, setState] = useState("idle"); // idle | connecting | listening | thinking | speaking | error | ended
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState([]); // committed {id, speaker, text}
  const [partial, setPartial] = useState(null); // in-progress {speaker, text} or null
  const [toolCalls, setToolCalls] = useState([]); // {id, name, status, summary}
  const [error, setError] = useState(null);
  const [endReason, setEndReason] = useState(null);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const inputCtxRef = useRef(null);
  const outputCtxRef = useRef(null);
  const recorderNodeRef = useRef(null);
  const playerNodeRef = useRef(null);
  const acceptedTurnSeqRef = useRef(0);
  const mountedRef = useRef(true);
  // Speaker + turnSeq of the last committed transcript line. Consecutive
  // finals with the same speaker AND turnSeq are fragments of one utterance
  // (the server bumps turnSeq only at turnComplete), so they merge into the
  // line they created instead of spawning a new bubble.
  const lastFinalTurnRef = useRef(null);

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

  const startCapture = useCallback(async (inputSampleRate) => {
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
    await inputCtx.audioWorklet.addModule("/voice/pcm-recorder-worklet.js");

    const source = inputCtx.createMediaStreamSource(stream);
    const recorderNode = new AudioWorkletNode(
      inputCtx,
      "pcm-recorder-processor",
    );
    recorderNode.port.onmessage = (event) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(event.data);
      }
    };
    recorderNodeRef.current = recorderNode;
    source.connect(recorderNode);
  }, []);

  const setupPlayback = useCallback(async (outputSampleRate) => {
    const outputCtx = new AudioContext({ sampleRate: outputSampleRate });
    outputCtxRef.current = outputCtx;
    await outputCtx.audioWorklet.addModule("/voice/pcm-player-worklet.js");

    const playerNode = new AudioWorkletNode(outputCtx, "pcm-player-processor");
    playerNode.connect(outputCtx.destination);
    playerNodeRef.current = playerNode;
  }, []);

  const upsertToolCall = useCallback((id, patch) => {
    setToolCalls((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return [...prev, { id, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const handleTranscript = useCallback((value) => {
    const { speaker, text, isFinal, turnSeq } = value;
    if (!isFinal) {
      setPartial({ speaker, text });
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
    (name, value) => {
      switch (name) {
        case "voice_session_ready":
          // Audio graph is built once, right here — after the server
          // confirms setup, matching voice_session_ready's whole purpose
          // (voice-agent-plan.md §5).
          Promise.all([
            setupPlayback(value.outputSampleRate),
            startCapture(value.inputSampleRate),
          ])
            .then(() => {
              if (mountedRef.current) setState("listening");
            })
            .catch((err) => {
              if (mountedRef.current) {
                setError(err);
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
          handleTranscript(value);
          break;
        case "voice_interrupted":
          acceptedTurnSeqRef.current = value.turnSeq;
          playerNodeRef.current?.port.postMessage({ type: "flush" });
          break;
        case "voice_session_resumed":
          // Transparent by design — nothing for the UI to do.
          break;
        case "voice_session_ended":
          setState("ended");
          setEndReason(value?.reason || null);
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
    [handleTranscript, setupPlayback, startCapture, teardownAudio],
  );

  const handleMessage = useCallback(
    (event) => {
      if (typeof event.data !== "string") {
        const buf = event.data;
        const view = new DataView(buf);
        const turnSeq = view.getUint32(0, true);
        // The server bumps turnSeq on EVERY new agent utterance (not just
        // on a barge-in) — turn 1 is seq 0, turn 2 is seq 1, and so on. A
        // strict equality check here only ever matched the very first
        // turn's frames, since acceptedTurnSeqRef only advances inside the
        // voice_interrupted handler below, which never fires on a normal
        // turn boundary — so every turn after the first was silently
        // dropped. Accepting (and adopting) anything >= the last accepted
        // value handles normal progression automatically; WebSocket
        // delivers messages in send order on one connection, so a
        // voice_interrupted event always arrives before any frame from the
        // new generation it announces — nothing older can arrive after it.
        if (turnSeq >= acceptedTurnSeqRef.current) {
          acceptedTurnSeqRef.current = turnSeq;
          const pcmBytes = buf.slice(4);
          playerNodeRef.current?.port.postMessage(pcmBytes, [pcmBytes]);
        }
        return;
      }

      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "CUSTOM":
          handleCustomEvent(msg.name, msg.value);
          break;
        case "TOOL_CALL_CHUNK":
          upsertToolCall(msg.toolCallId, {
            name: msg.toolCallName,
            status: "running",
          });
          break;
        case "TOOL_CALL_RESULT": {
          let parsed = null;
          try {
            parsed = JSON.parse(msg.content);
          } catch {
            parsed = { output: msg.content };
          }
          upsertToolCall(msg.toolCallId, {
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
          setError(new Error(msg.message || "The agent run failed."));
          setState("error");
          break;
        default:
          break;
      }
    },
    [handleCustomEvent, upsertToolCall],
  );

  const start = useCallback(async () => {
    setError(null);
    setEndReason(null);
    setTranscript([]);
    setPartial(null);
    setToolCalls([]);
    acceptedTurnSeqRef.current = 0;
    setState("connecting");

    try {
      const res = await createProjectAgentVoiceSession(projectId, agentId);
      const { wsUrl } = res.data?.data || {};
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
        setError(err);
        setState("error");
      }
      teardownAudio();
    }
  }, [agentId, handleMessage, projectId, teardownAudio]);

  const mute = useCallback((muted) => {
    setIsMuted(muted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);

  const sendText = useCallback((text) => {
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
