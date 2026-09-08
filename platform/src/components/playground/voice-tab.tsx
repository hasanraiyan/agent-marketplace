"use client";

import * as React from "react";
import { CheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useVoiceSession, type VoiceSessionState } from "@/hooks/use-voice-session";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  VoiceIndicator,
  VoiceModeIcon,
  type ChatMessageData,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Ported from frontend/src/components/agents/voice/VoiceTestPanel.jsx — the
// Agent Test playground's Voice tab. useVoiceSession owns the WebSocket +
// Web Audio pipeline; this component only renders it (state orb, live
// transcript, tool-call chips, type-instead-of-speaking input).
const STATE_LABEL: Record<VoiceSessionState, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Error",
  ended: "Call ended",
};

function isLive(state: VoiceSessionState): boolean {
  return (
    state === "connecting" ||
    state === "listening" ||
    state === "thinking" ||
    state === "speaking"
  );
}

function VoiceTab({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const voice = useVoiceSession({ projectId, agentId });
  const { state, isMuted, transcript, partial, toolCalls, error, endReason } = voice;

  const live = isLive(state);
  const [text, setText] = React.useState("");

  const handleSendToVoice = React.useCallback(
    (value: string) => {
      setText("");
      voice.sendText(value);
    },
    [voice]
  );

  const transcriptLines: ChatMessageData[] = React.useMemo(() => {
    const lines: ChatMessageData[] = transcript.map((line) => ({
      id: line.id,
      role: line.speaker === "user" ? "user" : "assistant",
      content: line.text,
    }));
    if (partial?.text) {
      lines.push({
        id: "partial",
        role: partial.speaker === "user" ? "user" : "assistant",
        content: partial.text,
        isStreaming: true,
      });
    }
    return lines;
  }, [transcript, partial]);

  const showTranscript = transcriptLines.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {live && (
        <div className="flex flex-col items-center gap-1.5 pt-6">
          <VoiceIndicator state={state} size={104} />
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {isMuted && (state === "listening" || state === "speaking")
              ? "Muted"
              : STATE_LABEL[state]}
          </span>
          {toolCalls.length > 0 && (
            <div className="mt-2 flex max-w-3xl flex-wrap items-center justify-center gap-1.5 px-4">
              {toolCalls.map((tc) => (
                <span
                  key={tc.id}
                  className="inline-flex items-center gap-1.5 rounded-none border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {tc.status === "running" ? (
                    <Spinner className="size-3 text-primary" />
                  ) : tc.status === "error" ? (
                    <WarningCircleIcon className="size-3 text-destructive" />
                  ) : (
                    <CheckIcon className="size-3" />
                  )}
                  <span className="font-medium text-foreground/80">
                    {tc.name ?? "Tool"}
                  </span>
                  {tc.summary ? (
                    <span className="max-w-56 truncate">{tc.summary}</span>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {showTranscript ? (
          <ChatScroller>
            {transcriptLines.map((line) => (
              <ChatScrollerItem key={line.id}>
                <ChatMessage message={line} />
              </ChatScrollerItem>
            ))}
          </ChatScroller>
        ) : live ? null : (
          <ChatEmptyState
            title="Voice preview"
            description="Talk to your agent out loud — it runs with the same tools and knowledge as the chat tab. Start a call to begin."
          />
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-2 pb-4">
        {live && (state === "listening" || state === "speaking") && (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => voice.mute(!isMuted)}
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Voice call failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {state === "ended" && (
          <Alert>
            <AlertTitle>Call ended</AlertTitle>
            {endReason ? <AlertDescription>{endReason}</AlertDescription> : null}
          </Alert>
        )}

        {live ? (
          <ChatComposer
            value={text}
            onChange={setText}
            onSend={() => {}}
            isVoiceActive
            onStopVoice={voice.stop}
            onSendToVoice={handleSendToVoice}
            // Text sent before the socket is open is dropped (sendText
            // no-ops), so hold the field until the session is actually live.
            disabled={state === "connecting"}
            placeholder="Type to voice…"
          />
        ) : (
          <Button
            type="button"
            variant="default"
            onClick={() => {
              // start() clears the transcript; drop any text left over from a
              // previous call so it doesn't surface once the field re-enables.
              setText("");
              void voice.start();
            }}
            className="w-full"
          >
            <VoiceModeIcon />
            Start voice call
          </Button>
        )}
      </div>
    </div>
  );
}

export { VoiceTab };
