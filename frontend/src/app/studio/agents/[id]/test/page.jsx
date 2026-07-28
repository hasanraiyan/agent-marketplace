"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  BotIcon,
  FileText,
  ListTodo,
  Loader2,
  PencilIcon,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AguiAgentChat,
  AguiFilesPanel,
} from "@/components/agents/agui-agent-chat";
import { McpConnectBanner } from "@/components/agents/mcp-connect-banner";
import { getAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { StudioAgentTabs } from "@/components/studio/studio-agent-tabs";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

/**
 * Studio playground — a creator-oriented surface over the SAME AG-UI runtime
 * the consumer chat uses (AguiAgentChat + /agui endpoint + threads API).
 *
 * The difference from /dashboard/agents/:id/run is intent, not infrastructure:
 * a test session starts clean every time and is not wired into the consumer
 * thread history sidebar, so creators can iterate without polluting it.
 */
export default function StudioAgentTestPage({ params }) {
  const { id: agentId } = use(params);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [agent, setAgent] = useState(null);
  const [thread, setThread] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentState, setAgentState] = useState({});
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState("files");
  const [selectedFile, setSelectedFile] = useState(null);

  // ── Token refresh (same cadence as the dashboard run surface) ──────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const refreshToken = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 40000);
    return () => clearInterval(interval);
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    const init = async () => {
      try {
        const [agentRes, threadRes] = await Promise.all([
          getAgent(agentId),
          createThread({ agentId }),
        ]);
        if (cancelled) return;
        setAgent(agentRes.data?.data || null);
        setThread(threadRes.data?.data || null);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Failed to start a test session",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [agentId, isLoaded, isSignedIn]);

  const resetSession = useCallback(async () => {
    try {
      const res = await createThread({ agentId });
      setThread(res.data?.data || null);
      setAgentState({});
      setSelectedFile(null);
      setShowPanel(false);
    } catch (err) {
      toast.error("Failed to reset the test session");
      throw err;
    }
  }, [agentId]);

  const handleOpenFile = useCallback((filePath) => {
    setPanelTab("files");
    setShowPanel(true);
    setSelectedFile(filePath);
  }, []);

  const togglePanel = useCallback(
    (tab) => {
      if (showPanel && panelTab === tab) {
        setShowPanel(false);
        return;
      }
      setPanelTab(tab);
      setShowPanel(true);
    },
    [panelTab, showPanel],
  );

  const fileCount = Object.keys(agentState?.files || {}).filter(
    (path) => !path.startsWith("/.versions/") && !path.startsWith(".versions/"),
  ).length;
  const todos = Array.isArray(agentState?.todos) ? agentState.todos : [];
  const todoDone = todos.filter((todo) => todo?.status === "completed").length;

  useDashboardHeader(
    {
      title: agent?.name || "Agent",
      description: "Test session — not saved to your conversations",
      leading: (
        <Avatar className="size-8">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} alt="" />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      tabs: <StudioAgentTabs agentId={agentId} active="test" />,
      actions: (
        <>
          {todos.length > 0 && (
            <Button
              variant={showPanel && panelTab === "plan" ? "secondary" : "ghost"}
              size="icon"
              className="relative size-9 rounded-full"
              title="Toggle plan"
              onClick={() => togglePanel("plan")}
            >
              <ListTodo className="size-4" />
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums shadow-sm">
                {todoDone}/{todos.length}
              </span>
            </Button>
          )}
          {fileCount > 0 && (
            <Button
              variant={
                showPanel && panelTab === "files" ? "secondary" : "ghost"
              }
              size="icon"
              className="relative size-9 rounded-full"
              title="Toggle files"
              onClick={() => togglePanel("files")}
            >
              <FileText className="size-4" />
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold shadow-sm">
                {fileCount}
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            title="Reset test session"
            onClick={resetSession}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Link href={studioRoutes.agentBuild(agentId)}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-bold"
            >
              <PencilIcon className="mr-1.5 size-3.5" />
              Build
            </Button>
          </Link>
        </>
      ),
    },
    [
      agent,
      agentId,
      fileCount,
      panelTab,
      resetSession,
      showPanel,
      todoDone,
      todos.length,
      togglePanel,
    ],
  );

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="text-primary size-7 animate-spin" />
      </div>
    );
  }

  const threadId = thread?._id || thread?.id;

  if (!threadId || !authToken) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-3">
          <BotIcon className="mx-auto size-10 text-slate-300 dark:text-slate-700" />
          <h2 className="text-base font-bold">Test session unavailable</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            The agent needs a configured model provider before it can run.
          </p>
          <Link href={studioRoutes.agentBuild(agentId)}>
            <Button variant="outline" className="rounded-full font-bold">
              Open the builder
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
      <McpConnectBanner mcps={agent?.mcps} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AguiAgentChat
          key={threadId}
          agent={agent}
          url={AGUI_RUNTIME_URL}
          agentId={agentId}
          threadId={threadId}
          title={agent?.name || "Agent"}
          emptyTitle={`Test ${agent?.name || "your agent"}`}
          emptyDescription={
            agent?.description ||
            "Send a prompt to see how this agent behaves before you publish it."
          }
          className="min-w-0 flex-1"
          showHeader={false}
          headers={{
            Authorization: `Bearer ${authToken}`,
            "X-Agent-Id": agentId,
            "X-Thread-Id": threadId,
          }}
          onStateChange={setAgentState}
          onNewChat={resetSession}
          onOpenFile={handleOpenFile}
        />
        <AguiFilesPanel
          state={agentState}
          open={showPanel}
          onOpenChange={setShowPanel}
          tab={panelTab}
          onTabChange={setPanelTab}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      </div>
    </div>
  );
}
