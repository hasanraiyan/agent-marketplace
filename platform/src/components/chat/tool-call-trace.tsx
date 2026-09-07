"use client";

import * as React from "react";
import { ItemGroup } from "@/components/ui/item";
import { ToolCallCard } from "./tool-call-card";
import type { ChatToolCall, ChatTodo } from "./types";

function parsePresentedFilePath(result: string | undefined): string | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (parsed?.status === "success" && typeof parsed.filePath === "string") {
      return parsed.filePath;
    }
  } catch {
    // malformed result — nothing to present
  }
  return null;
}

function ToolCallTrace({
  toolCalls,
  todos,
  onOpenSubagent,
  onOpenWorkspaceFile,
}: {
  toolCalls: ChatToolCall[];
  todos?: ChatTodo[];
  onOpenSubagent?: (toolCallId: string) => void;
  onOpenWorkspaceFile?: (path: string) => void;
}) {
  // Fires onOpenWorkspaceFile once per completed present_file call, not on
  // every render — a plain call inside the render/map below would re-fire
  // on every re-render and update state while rendering.
  const notifiedRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!onOpenWorkspaceFile) return;
    for (const tc of toolCalls) {
      if (tc.name !== "present_file" || notifiedRef.current.has(tc.id)) continue;
      const path = parsePresentedFilePath(tc.result);
      if (path) {
        notifiedRef.current.add(tc.id);
        onOpenWorkspaceFile(path);
      }
    }
  }, [toolCalls, onOpenWorkspaceFile]);

  if (!toolCalls.length) return null;

  return (
    <ItemGroup className="mb-2 gap-1.5!">
      {toolCalls.map((tc) => (
        <ToolCallCard
          key={tc.id}
          toolCall={tc}
          todos={todos}
          onOpenSubagent={onOpenSubagent}
        />
      ))}
    </ItemGroup>
  );
}

export { ToolCallTrace };
