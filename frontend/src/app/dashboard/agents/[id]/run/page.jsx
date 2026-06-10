"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AguiAgentChat,
  AguiFilesPanel,
} from "@/components/agents/agui-agent-chat";
import { getAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

export default function RunAgentPage() {
  const params = useParams();
  const agentId = params.id;
  const { getToken } = useAuth();

  const [agent, setAgent] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [agentState, setAgentState] = useState({});

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

  useEffect(() => {
    const init = async () => {
      try {
        const [agentRes, threadRes] = await Promise.all([
          getAgent(agentId),
          createThread({ agentId }),
        ]);
        setAgent(agentRes.data?.data);
        setThread(threadRes.data?.data);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load agent");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [agentId]);

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
  const runtimeUrl = AGUI_RUNTIME_URL;

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 lg:px-6">
        <Link
          href="/dashboard/agents"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to My Agents
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage
              src={agent?.avatarUrl || agent?.avatar}
              alt={agent?.name}
            />
            <AvatarFallback>
              <BotIcon />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {agent?.name || "Agent"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Badge variant="outline" className="capitalize">
                {agent?.category || "other"}
              </Badge>
              {agent?.modelName ? (
                <span className="truncate">{agent.modelName}</span>
              ) : null}
            </div>
          </div>
          <Link href={`/dashboard/agents/${agentId}/builder`}>
            <Button variant="outline" size="sm" className="rounded-full">
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {authToken && threadDbId ? (
          <>
            <AguiAgentChat
              agent={agent}
              url={runtimeUrl}
              agentId={agentId}
              threadId={threadDbId}
              title={agent?.name || "Sage"}
              emptyTitle={agent?.name || "Sage"}
              emptyDescription={
                agent?.description || "Ask this agent to work on your request."
              }
              className="min-w-0 flex-1"
              headers={{
                Authorization: `Bearer ${authToken}`,
                "X-Agent-Id": agentId,
                "X-Thread-Id": threadDbId,
              }}
              onStateChange={setAgentState}
            />
            <AguiFilesPanel state={agentState} />
          </>
        ) : null}
      </div>
    </div>
  );
}
