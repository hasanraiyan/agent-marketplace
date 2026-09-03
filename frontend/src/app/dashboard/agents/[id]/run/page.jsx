"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon, FileText, ListTodo } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AguiAgentChat,
  AguiFilesPanel,
  NewChatIcon,
} from "@/components/agents/agui-agent-chat";
import { McpConnectBanner } from "@/components/agents/mcp-connect-banner";
import { getAgent } from "@/lib/api/agents";
import { getSkillPlay } from "@/lib/api/skills";
import { SkillCover, skillCategoryLabel } from "@/components/skills/skill-cover";
import { XIcon, SparklesIcon } from "lucide-react";
import { createThread, getThread, getThreadMessages } from "@/lib/api/threads";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { normaliseLangChainMessages } from "@/lib/agui/normalise-messages";
import { useUserThreads } from "@/hooks/use-user-threads";
import { cn } from "@/lib/utils";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.persona.hasanraiyan.me/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;


export default function RunAgentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = params.id;
  const { getToken } = useAuth();
  const { refresh: refreshThreads, renameThread } = useUserThreads();

  // If the user navigated from the sidebar, ?threadId will be set
  const urlThreadId = searchParams.get("threadId");

  const [agent, setAgent] = useState(null);
  const [thread, setThread] = useState(null);
  const [initialMessages, setInitialMessages] = useState({
    messages: [],
    toolCalls: [],
    conversation: [],
  });
  const [initialState, setInitialState] = useState({});
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [agentState, setAgentState] = useState({});
  const [chatResetKey, setChatResetKey] = useState(0);
  const [sessionKey, setSessionKey] = useState(() =>
    urlThreadId === "new" || !urlThreadId ? `new-${Date.now()}` : urlThreadId,
  );
  const promotingRef = useRef(false);
  const [showFiles, setShowFiles] = useState(false);
  const [panelTab, setPanelTab] = useState("files");
  const [selectedFile, setSelectedFile] = useState(null);
  // "Play a skill": the published skill pinned to this conversation.
  const skillParam = searchParams.get("skill");
  const [pinnedSkill, setPinnedSkill] = useState(null);

  // ── Token refresh ────────────────────────────────────────────────────────────
  useEffect(() => {
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
  }, [getToken]);

  // ── Load agent + thread ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (promotingRef.current) {
        promotingRef.current = false;
        return;
      }

      // If the current thread state already matches the URL, skip (prevents re-fetch after promotion)
      if (
        urlThreadId &&
        (thread?._id === urlThreadId || thread?.id === urlThreadId)
      ) {
        return;
      }

      setLoading(true);
      setInitialMessages({ messages: [], toolCalls: [], conversation: [] });
      setInitialState({});

      try {
        const agentRes = await getAgent(agentId);
        setAgent(agentRes.data?.data);
        // Resolve the pinned skill: explicit ?skill= wins, else the thread's.
        let skillIdToLoad = skillParam;

        if (urlThreadId && urlThreadId !== "new") {
          // ── Resume existing thread ─────────────────────────────────────────
          const [threadRes, historyRes] = await Promise.all([
            getThread(urlThreadId),
            getThreadMessages(urlThreadId),
          ]);

          const loadedThread = threadRes.data?.data;
          if (!loadedThread) throw new Error("Thread not found");
          setThread(loadedThread);
          if (!skillIdToLoad && loadedThread.skillId) {
            skillIdToLoad =
              loadedThread.skillId?._id || loadedThread.skillId;
          }
          setSessionKey(urlThreadId);

          const {
            messages: rawMessages = [],
            state: rawState = {},
            subagentTraces = {},
          } = historyRes.data?.data || {};
          setInitialMessages(
            normaliseLangChainMessages(rawMessages, subagentTraces),
          );
          setInitialState(rawState);
          setAgentState(rawState);
          setSelectedFile(null);
        } else {
          // ── Initialize virtual thread ──────────────────────────────────────
          setThread({ _id: "new", title: "New Conversation" });
          setSessionKey(`new-${Date.now()}`);
          setInitialMessages({ messages: [], toolCalls: [], conversation: [] });
          setInitialState({});
          setAgentState({});
          setSelectedFile(null);
        }
        if (skillIdToLoad) {
          try {
            const playRes = await getSkillPlay(skillIdToLoad);
            setPinnedSkill(playRes.data?.data || null);
          } catch {
            setPinnedSkill(null);
          }
        } else {
          setPinnedSkill(null);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load chat");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, urlThreadId, skillParam]);

  // ── "New Chat" handler ───────────────────────────────────────────────────────
  const skillQuery = pinnedSkill?._id ? `&skill=${pinnedSkill._id}` : "";

  const handleNewChat = useCallback(async () => {
    // Navigate to virtual 'new' thread, the sidebar update will happen once a message is sent.
    router.replace(
      `/dashboard/agents/${agentId}/run?threadId=new${skillQuery}`,
      { scroll: false },
    );
  }, [agentId, router, skillQuery]);

  const handleUnpinSkill = useCallback(() => {
    setPinnedSkill(null);
    router.replace(`/dashboard/agents/${agentId}/run?threadId=new`, {
      scroll: false,
    });
  }, [agentId, router]);

  const handleCreateThread = useCallback(async () => {
    try {
      promotingRef.current = true;
      const res = await createThread({
        agentId,
        ...(pinnedSkill?._id ? { skillId: pinnedSkill._id } : {}),
      });
      const newThread = res.data?.data;
      const newId = newThread?._id || newThread?.id;

      setThread(newThread);

      // Update URL to the new thread ID (keep the pinned skill in the URL)
      router.replace(
        `/dashboard/agents/${agentId}/run?threadId=${newId}${skillQuery}`,
        { scroll: false },
      );

      // Refresh sidebar thread list
      refreshThreads();

      return newId;
    } catch (err) {
      promotingRef.current = false;
      toast.error("Failed to persist conversation");
      throw err;
    }
  }, [agentId, refreshThreads, router, pinnedSkill, skillQuery]);

  const handleOpenFile = useCallback((filePath) => {
    setPanelTab("files");
    setShowFiles(true);
    setSelectedFile(filePath);
  }, []);

  const fileCount = Object.keys(agentState?.files || {}).filter(
    (path) => !path.startsWith("/.versions/") && !path.startsWith(".versions/"),
  ).length;
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
      description:
        agent?.tagline ||
        [agent?.category || "other", agent?.modelName]
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
              variant={
                showFiles && panelTab === "files" ? "secondary" : "ghost"
              }
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
          <Link href={studioRoutes.agentBuild(agentId)}>
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

  const handleRunFinished = useCallback(() => {
    refreshThreads();
  }, [refreshThreads]);

  const handleTitleGenerated = useCallback(
    (newTitle) => {
      const threadDbId = thread?._id || thread?.id;
      if (!threadDbId) return;

      // Update local state
      setThread((prev) => (prev ? { ...prev, title: newTitle } : prev));

      // Update global sidebar state immediately
      renameThread(threadDbId, newTitle).catch((err) => {
        console.error("Failed to sync auto-title to sidebar:", err);
      });
    },
    [thread, renameThread],
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    );
  }

  const threadDbId = thread?._id || thread?.id;

  return (
    <div className="@container/main absolute inset-0 flex flex-col overflow-hidden bg-white">
      <McpConnectBanner mcps={agent?.mcps} />
      {pinnedSkill ? (
        <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
          <SkillCover
            skill={pinnedSkill}
            persona={pinnedSkill.persona}
            className="size-9 shrink-0 rounded-lg"
            showTitle={false}
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
              <SparklesIcon className="size-3 text-[#1E60FF]" />
              Playing skill · {skillCategoryLabel(pinnedSkill.category)}
            </p>
            <p className="truncate text-[13px] font-semibold text-zinc-900">
              {pinnedSkill.title}
              <span className="ml-2 font-medium text-zinc-500">
                by {pinnedSkill.persona?.name || agent?.name}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleUnpinSkill}
            title="Stop using this skill"
            className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 cursor-pointer"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {authToken && threadDbId ? (
          <>
            <AguiAgentChat
              key={`${sessionKey}-${chatResetKey}`}
              agent={agent}
              url={AGUI_RUNTIME_URL}
              agentId={agentId}
              threadId={threadDbId}
              initialMessages={initialMessages}
              initialState={initialState}
              title={agent?.name || "Sage"}
              emptyTitle={pinnedSkill ? pinnedSkill.title : agent?.name || "Sage"}
              emptyDescription={
                pinnedSkill
                  ? pinnedSkill.hook ||
                    pinnedSkill.description ||
                    `${agent?.name} will use this skill for you.`
                  : agent?.description ||
                    "Ask this agent to work on your request."
              }
              emptyStateVariant={pinnedSkill ? "simple" : "profile"}
              suggestedPrompts={
                pinnedSkill
                  ? [
                      {
                        title: `Use "${pinnedSkill.title}" on my situation`,
                        prompt: `I want to use your "${pinnedSkill.title}" skill. Ask me what you need to know first, then apply it.`,
                      },
                      {
                        title: "What does this skill cover?",
                        prompt: `Explain what your "${pinnedSkill.title}" skill covers, what it refuses, and what I get out of it.`,
                      },
                      {
                        title: "Show me an example",
                        prompt: `Give me a short worked example of "${pinnedSkill.title}" applied to a typical case.`,
                      },
                    ]
                  : undefined
              }
              className="min-w-0 flex-1"
              showHeader={false}
              headers={{
                Authorization: `Bearer ${authToken}`,
                "X-Agent-Id": agentId,
                "X-Thread-Id": threadDbId,
                ...(pinnedSkill?._id ? { "X-Skill-Id": pinnedSkill._id } : {}),
              }}
              onStateChange={setAgentState}
              onCreateThread={handleCreateThread}
              onNewChat={handleNewChat}
              onRunFinished={handleRunFinished}
              onOpenFile={handleOpenFile}
              onTitleGenerated={handleTitleGenerated}
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
          </>
        ) : null}
      </div>
    </div>
  );
}
