"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Adapted from JimLiu/claude-agent-kit (MIT)
// examples/claude-code-web/src/client/components/chat/thinking-indicator.tsx
// Ported to JSX + our Tailwind tokens. The charm is the rotating status verb
// ("Pondering...", "Brewing...") with a scramble-ticker reveal and a braille
// spinner — far livelier than three bouncing dots.

const SPINNER_BASE_FRAMES = ["·", "✢", "*", "✶", "✻", "✽"];
const SPINNER_FRAMES = [
  ...SPINNER_BASE_FRAMES,
  ...[...SPINNER_BASE_FRAMES].reverse(),
];

const STATUS_WORDS = [
  "Thinking",
  "Pondering",
  "Reasoning",
  "Considering",
  "Deliberating",
  "Mulling",
  "Cogitating",
  "Ruminating",
  "Contemplating",
  "Working",
  "Computing",
  "Brewing",
  "Cooking",
  "Simmering",
  "Percolating",
  "Crunching",
  "Deciphering",
  "Puzzling",
  "Unravelling",
  "Synthesizing",
  "Scheming",
  "Tinkering",
  "Crafting",
  "Concocting",
  "Spelunking",
  "Wrangling",
  "Noodling",
  "Musing",
  "Ideating",
  "Envisioning",
];

const MAX_STATUS_WORD_LENGTH = Math.max(
  ...STATUS_WORDS.map((word) => word.length),
);

const REVEAL_WINDOW = 3;
const FRAME_INTERVAL_MS = 120;

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function padToLength(value, minLength) {
  return value.length >= minLength
    ? value
    : `${value}${" ".repeat(minLength - value.length)}`;
}

function replaceCharacter(source, index, value) {
  if (index < 0 || index >= source.length) return source;
  return `${source.slice(0, index)}${value}${source.slice(index + 1)}`;
}

function animateCharacter(previousChar, targetChar, phase) {
  if (targetChar === " ") return " ";
  switch (phase) {
    case 3:
      return targetChar;
    case 2:
    case 1:
      return pickRandom([".", "_", targetChar]);
    default:
      return "▌";
  }
}

function useDynamicTimeoutLoop(callback, getDelay) {
  const callbackRef = useRef(callback);
  const delayRef = useRef(getDelay);
  const iterationRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    delayRef.current = getDelay;
  }, [getDelay]);

  useEffect(() => {
    iterationRef.current = 0;

    function tick() {
      callbackRef.current();
      const delay = delayRef.current(iterationRef.current);
      iterationRef.current += 1;
      if (delay !== null) {
        timerRef.current = window.setTimeout(tick, delay);
      }
    }

    const initialDelay = delayRef.current(0);
    iterationRef.current = 1;
    if (initialDelay !== null) {
      timerRef.current = window.setTimeout(tick, initialDelay);
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);
}

function useAnimatedTickerText(target, minLength) {
  const [displayText, setDisplayText] = useState(() =>
    " ".repeat(Math.max(minLength, target.length)),
  );
  const animationState = useRef({
    index: 0,
    targetText: padToLength(target, minLength),
  });

  useEffect(() => {
    animationState.current.index = 0;
    animationState.current.targetText = padToLength(target, minLength);

    let animationFrame = null;
    let lastTimestamp = 0;

    const step = (timestamp) => {
      if (timestamp - lastTimestamp < 40) {
        animationFrame = window.requestAnimationFrame(step);
        return;
      }

      lastTimestamp = timestamp;
      const currentIndex = animationState.current.index;

      if (
        currentIndex - REVEAL_WINDOW >=
        animationState.current.targetText.length
      ) {
        animationFrame = null;
        return;
      }

      animationState.current.index += 1;

      setDisplayText((previous) => {
        let next = previous;
        for (let phase = 0; phase <= REVEAL_WINDOW; phase += 1) {
          const charIndex = currentIndex - phase;
          if (
            charIndex >= 0 &&
            charIndex < animationState.current.targetText.length
          ) {
            const previousChar = previous[charIndex] ?? " ";
            const targetChar = animationState.current.targetText[charIndex];
            next = replaceCharacter(
              next,
              charIndex,
              animateCharacter(previousChar, targetChar, phase),
            );
          }
        }
        return next;
      });

      animationFrame = window.requestAnimationFrame(step);
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [target, minLength]);

  return displayText;
}

export function ThinkingIndicator({ size = 15, className }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [statusWord, setStatusWord] = useState(() => pickRandom(STATUS_WORDS));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useDynamicTimeoutLoop(
    () => setStatusWord(pickRandom(STATUS_WORDS)),
    (iteration) => {
      const delays = [2200, 3200, 5200];
      return iteration < delays.length ? delays[iteration] : 5200;
    },
  );

  const animatedStatus = useAnimatedTickerText(
    `${statusWord}...`,
    MAX_STATUS_WORD_LENGTH + 3,
  );

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="inline-block w-5 shrink-0 text-center font-mono text-indigo-400"
        style={{ fontSize: `${size}px` }}
        aria-hidden="true"
      >
        {SPINNER_FRAMES[frameIndex]}
      </span>
      <span className="text-[13px] font-medium tracking-tight whitespace-pre text-slate-500 dark:text-slate-400">
        {animatedStatus}
      </span>
    </span>
  );
}
