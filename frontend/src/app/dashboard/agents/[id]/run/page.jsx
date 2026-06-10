"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon } from "lucide-react";
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
import { getAgent } from "@/lib/api/agents";
import { createThread, getThread, getThreadMessages } from "@/lib/api/threads";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { useUserThreads } from "@/hooks/use-user-threads";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

/**
 * Normalise LangChain / LangGraph message objects into the shape
 * useAguiChat / AguiAgentChat expects: { id, role, content }
 *
 * LangGraph MongoDBSaver stores messages as serialised LangChain objects:
 *   {
 *     lc: 1,
 *     type: "constructor",           ← always "constructor", NOT the role!
 *     id:   ["langchain_core", "messages", "human", "HumanMessage"],
 *     kwargs: { content: "...", ... }
 *   }
 *
 * The role lives in the LAST element of the `id` array.
 * We also accept the simpler { type: "human"|"ai", content } shape as a fallback.
 */
function normaliseLangChainMessages(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((msg, i) => {
      if (!msg) return null;

      // ── Unwrap LangChain constructor serialisation ──────────────────────────
      // Shape: { lc:1, type:"constructor", id:[...classPath], kwargs:{...} }
      const isLcConstructor =
        msg.lc === 1 && msg.type === "constructor" && Array.isArray(msg.id);

      const className = isLcConstructor
        ? (msg.id[msg.id.length - 1] || "").toLowerCase()
        : "";

      const m = isLcConstructor
        ? { ...(msg.kwargs || {}), _lcClassName: className }
        : msg;

      // ── Extract content ─────────────────────────────────────────────────────
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((p) => (typeof p === "string" ? p : p?.text || ""))
                .join("")
            : "";

      // ── Determine role ──────────────────────────────────────────────────────
      // Priority 1: LangChain class name from id array
      const lc = m._lcClassName || "";
      // Priority 2: explicit type field (simple shape)
      const typeField = (m.type || m._type || "").toLowerCase();

      let role = "assistant";
      const roleHint = lc || typeField;
      if (roleHint.includes("human")) role = "user";
      else if (roleHint.includes("ai") || roleHint.includes("assistant"))
        role = "assistant";
      else if (roleHint.includes("system")) role = "system";

      // ── Stable id ──────────────────────────────────────────────────────────
      const id = m.id || `history-${i}`;

      return { id, role, content };
    })
    .filter((m) => m && m.content && m.role !== "system"); // drop empties + system msgs
}

export default function RunAgentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = params.id;
  const { getToken } = useAuth();
  const { refresh: refreshThreads } = useUserThreads();

  // If the user navigated from the sidebar, ?threadId will be set
  const urlThreadId = searchParams.get("threadId");

  const [agent, setAgent] = useState(null);
  const [thread, setThread] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [agentState, setAgentState] = useState({});
  const [chatResetKey, setChatResetKey] = useState(0);

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
      setLoading(true);
      setInitialMessages([]);

      try {
        const agentRes = await getAgent(agentId);
        setAgent(agentRes.data?.data);

        if (urlThreadId) {
          // ── Resume existing thread ─────────────────────────────────────────
          const [threadRes, messagesRes] = await Promise.all([
            getThread(urlThreadId),
            getThreadMessages(urlThreadId),
          ]);

          const loadedThread = threadRes.data?.data;
          if (!loadedThread) throw new Error("Thread not found");
          setThread(loadedThread);

          const rawMessages = messagesRes.data?.data || [];
          setInitialMessages(normaliseLangChainMessages(rawMessages));
        } else {
          // ── Create a fresh thread ──────────────────────────────────────────
          const threadRes = await createThread({ agentId });
          const newThread = threadRes.data?.data;
          setThread(newThread);
          setInitialMessages([]);

          // Reflect the new thread in the URL so refreshes re-open the same one
          const newId = newThread?._id || newThread?.id;
          if (newId) {
            router.replace(
              `/dashboard/agents/${agentId}/run?threadId=${newId}`,
              { scroll: false }
            );
          }

          // Refresh sidebar thread list
          refreshThreads();
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load chat");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, urlThreadId]);

  // ── "New Chat" handler ───────────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    try {
      const res = await createThread({ agentId });
      const newThread = res.data?.data;
      const newId = newThread?._id || newThread?.id;

      setThread(newThread);
      setInitialMessages([]);
      setChatResetKey((k) => k + 1);

      // Navigate to new thread, which will also update the sidebar
      router.replace(
        `/dashboard/agents/${agentId}/run?threadId=${newId}`,
        { scroll: false }
      );
      refreshThreads();
    } catch (err) {
      toast.error("Failed to start a new chat");
      throw err; // Let AguiAgentChat fall back to chat.clear()
    }
  }, [agentId, refreshThreads, router]);

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
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            My Agents
          </Link>
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
    [agent, agentId, handleNewChat],
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
    <div className="@container/main flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {authToken && threadDbId ? (
          <>
            <AguiAgentChat
              key={`${threadDbId}-${chatResetKey}`}
              agent={agent}
              url={AGUI_RUNTIME_URL}
              agentId={agentId}
              threadId={threadDbId}
              initialMessages={initialMessages}
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
            />
            <AguiFilesPanel state={agentState} />
          </>
        ) : null}
      </div>
    </div>
  );
}
