"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { BotIcon, FileText, ListTodo, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AguiAgentChat,
  AguiFilesPanel,
  NewChatIcon,
} from "@/components/agents/agui-agent-chat";
import { useDashboardHeader } from "@/components/dashboard-header-context";

export function AgentRunWorkspace({
  agent,
  agentId,
  authToken,
  threadDbId,
  initialMessages,
  initialState,
  chatResetKey,
  handleNewChat,
  handleRunFinished,
  AGUI_RUNTIME_URL,
}) {
  const [agentState, setAgentState] = useState(initialState || {});
  const [showFiles, setShowFiles] = useState(false);
  const [panelTab, setPanelTab] = useState("files");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleOpenFile = useCallback((filePath) => {
    setPanelTab("files");
    setShowFiles(true);
    setSelectedFile(filePath);
  }, []);

  const fileCount = Object.keys(agentState?.files || {}).length;
  const todos = Array.isArray(agentState?.todos) ? agentState.todos : [];
  const todoCount = todos.length;
  const todoDone = todos.filter((todo) => todo?.status === "completed").length;

  // Toggle the side panel: clicking the active tab's button closes it,
  // otherwise the panel opens (or switches) to that tab.
  const openPanel = useCallback(
    (tab) => {
      if (showFiles && panelTab === tab) {
        setShowFiles(false);
      } else {
        setPanelTab(tab);
        setShowFiles(true);
      }
    },
    [panelTab, showFiles],
  );

  // ── Dashboard header ─────────────────────────────────────────────────────────
  useDashboardHeader(
    {
      title: agent?.name || "Agent",
      description: [agent?.category || "other", agent?.modelName]
        .filter(Boolean)
        .join(" · "),
      leading: (
        <Avatar className="size-8">
          <AvatarImage
            src={agent?.avatarUrl || agent?.avatar}
            alt={agent?.name}
          />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      actions: (
        <>
          <Link
            href="/dashboard/agents"
            className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="size-4" />
            My Agents
          </Link>
          {todoCount > 0 && (
            <Button
              variant={showFiles && panelTab === "plan" ? "secondary" : "ghost"}
              size="icon"
              className="relative size-9 rounded-full"
              title="Toggle Plan"
              onClick={() => openPanel("plan")}
            >
              <ListTodo className="size-4" />
              <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-foreground shadow-sm">
                {todoDone}/{todoCount}
              </span>
            </Button>
          )}
          {fileCount > 0 && (
            <Button
              variant={showFiles && panelTab === "files" ? "secondary" : "ghost"}
              size="icon"
              className="relative size-9 rounded-full"
              title="Toggle Files"
              onClick={() => openPanel("files")}
            >
              <FileText className="size-4" />
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                {fileCount}
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            title="New Chat"
            onClick={handleNewChat}
          >
            <NewChatIcon className="size-4" />
          </Button>
          <Link href={`/dashboard/agents/${agentId}/builder`}>
            <Button variant="outline" size="sm" className="rounded-full">
              Edit
            </Button>
          </Link>
        </>
      ),
    },
    [
      agent,
      agentId,
      handleNewChat,
      showFiles,
      fileCount,
      panelTab,
      todoCount,
      todoDone,
      openPanel,
    ],
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <AguiAgentChat
        key={`${threadDbId}-${chatResetKey}`}
        agent={agent}
        url={AGUI_RUNTIME_URL}
        agentId={agentId}
        threadId={threadDbId}
        initialMessages={initialMessages}
        initialState={initialState}
        title={agent?.name || "Sage"}
        emptyTitle={agent?.name || "Sage"}
        emptyDescription={
          agent?.description || "Ask this agent to work on your request."
        }
        className="min-w-0 flex-1"
        showHeader={false}
        headers={{
          Authorization: `Bearer ${authToken}`,
          "X-Agent-Id": agentId,
          "X-Thread-Id": threadDbId,
        }}
        onStateChange={setAgentState}
        onNewChat={handleNewChat}
        onRunFinished={handleRunFinished}
        onOpenFile={handleOpenFile}
      />
      <AguiFilesPanel
        state={agentState}
        open={showFiles}
        onOpenChange={setShowFiles}
        tab={panelTab}
        onTabChange={setPanelTab}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
      />
    </div>
  );
}
