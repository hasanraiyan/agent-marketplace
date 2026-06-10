"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentRunWorkspace } from "@/components/agents/agent-run-workspace";
import { getAgent } from "@/lib/api/agents";
import { createThread, getThread, getThreadMessages } from "@/lib/api/threads";
import { useUserThreads } from "@/hooks/use-user-threads";
import { normaliseLangChainMessages } from "@/lib/agui/messageNormalizer";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

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
  const [initialMessages, setInitialMessages] = useState({
    messages: [],
    toolCalls: [],
    conversation: [],
  });
  const [initialState, setInitialState] = useState({});
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
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
      setInitialMessages({ messages: [], toolCalls: [], conversation: [] });
      setInitialState({});

      try {
        const agentRes = await getAgent(agentId);
        setAgent(agentRes.data?.data);

        if (urlThreadId) {
          // ── Resume existing thread ─────────────────────────────────────────
          const [threadRes, historyRes] = await Promise.all([
            getThread(urlThreadId),
            getThreadMessages(urlThreadId),
          ]);

          const loadedThread = threadRes.data?.data;
          if (!loadedThread) throw new Error("Thread not found");
          setThread(loadedThread);

          const { messages: rawMessages = [], state: rawState = {} } =
            historyRes.data?.data || {};
          setInitialMessages(normaliseLangChainMessages(rawMessages));
          setInitialState(rawState);
        } else {
          // ── Create a fresh thread ──────────────────────────────────────────
          const threadRes = await createThread({ agentId });
          const newThread = threadRes.data?.data;
          setThread(newThread);
          setInitialMessages({ messages: [], toolCalls: [], conversation: [] });

          // Reflect the new thread in the URL so refreshes re-open the same one
          const newId = newThread?._id || newThread?.id;
          if (newId) {
            router.replace(
              `/dashboard/agents/${agentId}/run?threadId=${newId}`,
              { scroll: false },
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
      setInitialMessages({ messages: [], toolCalls: [], conversation: [] });
      setChatResetKey((k) => k + 1);

      // Navigate to new thread, which will also update the sidebar
      router.replace(`/dashboard/agents/${agentId}/run?threadId=${newId}`, {
        scroll: false,
      });
      refreshThreads();
    } catch (err) {
      toast.error("Failed to start a new chat");
      throw err; // Let AguiAgentChat fall back to chat.clear()
    }
  }, [agentId, refreshThreads, router]);

  const handleRunFinished = useCallback(() => {
    refreshThreads();
  }, [refreshThreads]);

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
      {authToken && threadDbId ? (
        <AgentRunWorkspace
          key={threadDbId}
          agent={agent}
          agentId={agentId}
          authToken={authToken}
          threadDbId={threadDbId}
          initialMessages={initialMessages}
          initialState={initialState}
          chatResetKey={chatResetKey}
          handleNewChat={handleNewChat}
          handleRunFinished={handleRunFinished}
          AGUI_RUNTIME_URL={AGUI_RUNTIME_URL}
        />
      ) : null}
    </div>
  );
}
