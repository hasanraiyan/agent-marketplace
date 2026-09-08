"use client";

import * as React from "react";
import { ItemGroup } from "@/components/ui/item";
import { ToolCallCard } from "./tool-call-card";
import { McpAppRenderer } from "./mcp-app-renderer";
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
  projectId,
  onOpenSubagent,
  onOpenWorkspaceFile,
}: {
  toolCalls: ChatToolCall[];
  todos?: ChatTodo[];
  projectId?: string;
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

  // Group consecutive regular tool calls together in ItemGroup,
  // and render MCP App tool calls as prominent standalone blocks.
  const elements: React.ReactNode[] = [];
  let currentGroup: ChatToolCall[] = [];

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      const groupKey = currentGroup[0].id;
      elements.push(
        <ItemGroup key={`group-${groupKey}`} className="gap-1.5!">
          {currentGroup.map((tc) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              todos={todos}
              onOpenSubagent={onOpenSubagent}
            />
          ))}
        </ItemGroup>
      );
      currentGroup = [];
    }
  };

  for (const tc of toolCalls) {
    if (tc.mcpApp?.resourceUri && tc.mcpApp?.mcpId) {
      flushGroup();
      elements.push(
        <div key={`mcp-app-${tc.id}`} className="w-full my-1.5">
          <McpAppRenderer
            projectId={projectId || ""}
            mcpId={tc.mcpApp.mcpId}
            resourceUri={tc.mcpApp.resourceUri}
            toolName={tc.name}
            tool={tc}
          />
        </div>
      );
    } else {
      currentGroup.push(tc);
    }
  }
  flushGroup();

  return <div className="flex flex-col gap-1.5 mb-2">{elements}</div>;
}

export { ToolCallTrace };

