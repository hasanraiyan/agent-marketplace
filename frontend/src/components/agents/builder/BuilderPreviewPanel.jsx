"use client";

import { BotIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";

export function BuilderPreviewPanel({
  isEdit,
  agent,
  agentId,
  authToken,
  previewThreadId,
  refreshPreview,
  runtimeUrl,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 shrink-0">
        <span className="text-sm font-bold">Preview</span>
        {isEdit ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshPreview}
            title="Reset Preview"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {isEdit && authToken && previewThreadId ? (
          <AguiAgentChat
            agent={agent}
            url={runtimeUrl}
            agentId={agentId}
            threadId={previewThreadId}
            title={agent?.name || "Agent preview"}
            emptyTitle={agent?.name || "Agent preview"}
            emptyDescription={
              agent?.description || "Test your agent before sharing it."
            }
            headers={{
              Authorization: `Bearer ${authToken}`,
              "X-Agent-Id": agentId,
              "X-Thread-Id": previewThreadId,
            }}
            onNewChat={refreshPreview}
            showHeader={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900">
            <div className="max-w-xs space-y-2">
              <BotIcon className="mx-auto size-12 text-muted-foreground opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">
                {isEdit
                  ? "Loading your agent preview..."
                  : "Create your agent with Sage or the Configure form — a live preview unlocks right after."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
