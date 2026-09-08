"use client";

import * as React from "react";
import {
  ArrowUpIcon,
  SquareIcon,
  PhoneXIcon,
} from "@phosphor-icons/react";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";

// Same "start voice mode" glyph NotebookChat.js's ComposerForm uses (a
// waveform, not a generic microphone) — inlined to match it exactly rather
// than substituting a similar-but-different icon from phosphor's set.
function VoiceModeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      {...props}
    >
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v8" />
      <path d="M18 5v14" />
      <path d="M22 10v3" />
    </svg>
  );
}

/**
 * Auto-resizing composer with the same 4-state trailing action button
 * NotebookChat.js's ComposerForm has: stop generating / send-to-voice while
 * a call is live / stop the call / send / start voice mode. Which state
 * applies is computed by the caller (isStreaming/isVoiceActive), not here —
 * this component only renders whatever state it's told.
 *
 * Deliberately no custom rounding/background overrides here — `InputGroup`/
 * `InputGroupButton` already carry this app's actual look (sharp
 * `rounded-none` everywhere, `Button`'s own variant colors), stacking a
 * borrowed rounded-pill/rounded-full treatment on top of them is exactly
 * what looked inconsistent and over-padded before.
 */
function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  onStartVoice,
  onStopVoice,
  onSendToVoice,
  isStreaming = false,
  isVoiceActive = false,
  disabled = false,
  placeholder,
  allowVoiceMode = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  onSendToVoice?: (text: string) => void;
  isStreaming?: boolean;
  isVoiceActive?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Chat-only surfaces (no voice mode) pass false to drop the idle waveform button. */
  allowVoiceMode?: boolean;
}) {
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    if (isVoiceActive) {
      onSendToVoice?.(trimmed);
    } else if (!isStreaming) {
      onSend();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? (isVoiceActive ? "Type to voice…" : "Ask anything…")}
          rows={1}
          disabled={disabled}
          className="max-h-40"
        />

        {/* The trailing action row is only mounted when it has something to
            show — surfaces without voice mode (allowVoiceMode={false}) get a
            plain composer until there is text to send, so no empty slot
            lingers in place of the waveform button. */}
        {(isStreaming || isVoiceActive || trimmed || allowVoiceMode) && (
          <InputGroupAddon align="block-end" className="justify-end">
            {isStreaming ? (
              <InputGroupButton
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Stop generating"
                onClick={onStop}
              >
                <SquareIcon weight="fill" />
              </InputGroupButton>
            ) : isVoiceActive ? (
              trimmed ? (
                <InputGroupButton type="submit" variant="default" size="icon-sm" aria-label="Send to voice">
                  <ArrowUpIcon />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Stop voice"
                  onClick={onStopVoice}
                >
                  <PhoneXIcon />
                </InputGroupButton>
              )
            ) : trimmed ? (
              <InputGroupButton type="submit" variant="default" size="icon-sm" aria-label="Send message">
                <ArrowUpIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="button"
                variant="default"
                size="icon-sm"
                aria-label="Use voice mode"
                onClick={onStartVoice}
              >
                <VoiceModeIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  );
}

export { ChatComposer, VoiceModeIcon };
