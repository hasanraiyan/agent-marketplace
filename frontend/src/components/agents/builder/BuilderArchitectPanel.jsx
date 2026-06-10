"use client";

import { Loader2 } from "lucide-react";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";
import { ARCHITECT_AGENT_ID } from "@/lib/constants";

export function BuilderArchitectPanel({
  activeTab,
  authToken,
  architectThreadId,
  runtimeUrl,
  handleArchitectToolResult,
  startNewArchitectChat,
  isEdit,
}) {
  return (
    <div
      className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${activeTab === "chat" ? "flex" : "hidden lg:flex"}`}
    >
      {authToken && architectThreadId ? (
        <AguiAgentChat
          url={runtimeUrl}
          agentId={ARCHITECT_AGENT_ID}
          threadId={architectThreadId}
          title="Sage"
          emptyTitle="Agent Architect"
          emptyDescription={
            isEdit
              ? "Tell Sage what you want to change about this agent."
              : "Tell Sage what kind of agent you want to build."
          }
          headers={{
            Authorization: `Bearer ${authToken}`,
            "X-Agent-Id": ARCHITECT_AGENT_ID,
            "X-Thread-Id": architectThreadId,
          }}
          onToolResult={handleArchitectToolResult}
          onNewChat={startNewArchitectChat}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
