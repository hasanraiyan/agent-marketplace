"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVoiceSession } from "@/hooks/useVoiceSession";

const STATE_LABEL = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Agent speaking",
  error: "Error",
  ended: "Call ended",
};

const STATE_ORB_CLASS = {
  idle: "bg-muted-foreground/30",
  connecting: "bg-amber-500 animate-pulse",
  listening: "bg-emerald-500 animate-pulse",
  thinking: "bg-amber-500 animate-pulse",
  speaking: "bg-blue-500 animate-pulse",
  error: "bg-destructive",
  ended: "bg-muted-foreground/30",
};

function ToolCallRow({ toolCall }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      {toolCall.status === "running" ? (
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : toolCall.status === "error" ? (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Wrench className="size-3 text-muted-foreground" />
          {toolCall.name || "tool"}
        </div>
        {toolCall.summary ? (
          <div className="mt-0.5 truncate text-muted-foreground">
            {toolCall.summary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Developer Studio Agent Test playground's Voice tab (voice-agent-plan.md
 * §13.1). A live phone-call-style test surface for the SAME Agent the Chat
 * tab already talks to — mic in, agent audio out, live captions, and a
 * trace of any tool calls the Agent made along the way.
 */
export function VoiceTestPanel({ projectId, agentId, agentName }) {
  const {
    state,
    isMuted,
    transcript,
    partial,
    toolCalls,
    error,
    start,
    stop,
    mute,
    sendText,
  } = useVoiceSession({ projectId, agentId });

  const [textInput, setTextInput] = useState("");
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, partial]);

  const isActive = state !== "idle" && state !== "ended" && state !== "error";

  const handleSubmitText = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendText(textInput);
    setTextInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden p-6">
      <div className="flex w-full max-w-lg flex-1 flex-col items-center">
        <div className="flex flex-col items-center gap-3 pt-6 pb-4">
          <div
            className={cn(
              "flex size-24 items-center justify-center rounded-full transition-colors duration-300",
              STATE_ORB_CLASS[state],
            )}
          >
            <Mic className="size-9 text-white" />
          </div>
          <Badge variant={state === "error" ? "destructive" : "secondary"}>
            {STATE_LABEL[state] || state}
          </Badge>
          {error ? (
            <p className="max-w-xs text-center text-xs text-destructive">
              {error.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 pb-6">
          {!isActive ? (
            <Button onClick={start} size="lg" className="rounded-full">
              <Phone className="mr-2 size-4" />
              Start call
            </Button>
          ) : (
            <>
              <Button
                onClick={() => mute(!isMuted)}
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
              <Button
                onClick={stop}
                variant="destructive"
                size="lg"
                className="rounded-full"
              >
                <PhoneOff className="mr-2 size-4" />
                End call
              </Button>
            </>
          )}
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
          {toolCalls.length > 0 ? (
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {toolCalls.map((tc) => (
                <ToolCallRow key={tc.id} toolCall={tc} />
              ))}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3">
            {transcript.length === 0 && !partial ? (
              <p className="m-auto text-center text-sm text-muted-foreground">
                Start a call to test {agentName || "this Agent"}&apos;s voice
                mode.
              </p>
            ) : (
              <>
                {transcript.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-1.5 text-sm",
                      line.speaker === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto bg-background",
                    )}
                  >
                    {line.text}
                  </div>
                ))}
                {partial ? (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-1.5 text-sm opacity-60",
                      partial.speaker === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto bg-background",
                    )}
                  >
                    {partial.text}
                  </div>
                ) : null}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>

          {isActive ? (
            <form onSubmit={handleSubmitText} className="flex gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or type instead of speaking…"
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="submit" size="icon" variant="outline">
                <Send className="size-4" />
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
