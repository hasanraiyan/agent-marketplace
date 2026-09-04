"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Adapted from JimLiu/claude-agent-kit (MIT)
// examples/claude-code-web/src/client/components/messages/expandable-content.tsx
// Collapses overflowing blocks behind a gradient fade with a
// monospace [Show more] / [Show less] toggle.

export function ExpandableContent({ children, maxHeight = 250, className }) {
  const containerRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setIsOverflowing(element.scrollHeight > maxHeight + 8);
  }, [children, maxHeight]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div
        ref={containerRef}
        className={cn(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          !expanded &&
            isOverflowing &&
            'relative after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-10 after:bg-gradient-to-b after:from-transparent after:to-white after:content-[""] dark:after:to-slate-950',
        )}
        style={!expanded && isOverflowing ? { maxHeight } : undefined}
      >
        {children}
      </div>
      {isOverflowing ? (
        <button
          type="button"
          className="mx-auto cursor-pointer border-0 bg-transparent p-[2px] font-mono text-[0.8em] text-slate-500 hover:underline dark:text-slate-400"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Show less" : "Show more"}
        >
          {expanded ? "[Show less]" : "[Show more]"}
        </button>
      ) : null}
    </div>
  );
}
