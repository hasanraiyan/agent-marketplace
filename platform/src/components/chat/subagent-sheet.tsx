"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChatMessage } from "./chat-message";
import type { ChatMessageData } from "./types";

/**
 * Slide-over replaying one subagent (`task` tool call)'s own message
 * timeline — reuses ChatMessage/ToolCallTrace rather than a separate
 * render path, same as NotebookChat.js's SubagentDialog does.
 */
function SubagentSheet({
  open,
  onOpenChange,
  messages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessageData[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Subagent</SheetTitle>
          <SheetDescription>
            A helper the agent delegated a step to — its own conversation.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { SubagentSheet };
