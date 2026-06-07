"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { getAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";
import { baseToolRenderers } from "@/lib/copilotkit/tool-renderers";
import { FilesPanel } from "@/components/agents/files-panel";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function RunAgentPage() {
  const params = useParams();
  const agentId = params.id;
  const { getToken } = useAuth();

  const [agent, setAgent] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  // Periodically refresh the auth token to prevent expiration (Clerk tokens expire in 60s)
  useEffect(() => {
    const refreshToken = async () => {
      try {
        const tok = await getToken();
        if (tok) {
          setAuthToken(tok);
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 40000); // refresh every 40 seconds
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
        <div className="flex flex-col gap-4 py-4 md:py-6 px-4 lg:px-6">
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
  const runtimeUrl = `${BASE_URL}/copilotkit`;
  const chatLabels = {
    title: agent?.name || "Agent",
    initial: agent?.description || "How can I help you today?",
  };
  const chatInput = {
    bottomAnchored: true,
  };

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-4 lg:px-6">
        <Link
          href="/dashboard/agents"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to My Agents
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={agent?.avatarUrl || agent?.avatar} alt={agent?.name} />
            <AvatarFallback>
              <BotIcon />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {agent?.name || "Agent"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="capitalize">
                {agent?.category || "other"}
              </Badge>
              {agent?.modelName && (
                <span className="truncate">{agent.modelName}</span>
              )}
            </div>
          </div>
          <Link href={`/dashboard/agents/${agentId}/builder`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {authToken && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CopilotKit
              runtimeUrl={runtimeUrl}
              useSingleEndpoint={false}
              headers={{
                Authorization: `Bearer ${authToken}`,
                "X-Agent-Id": agentId,
                ...(threadDbId ? { "X-Thread-Id": threadDbId } : {}),
              }}
              renderToolCalls={baseToolRenderers}
            >
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <CopilotChat
                  className="h-full min-h-0 flex-1"
                  labels={chatLabels}
                  input={chatInput}
                />
                {/* Mirrors the agent's virtual filesystem; renders nothing until
                    the agent creates files. Reads the same default agent the
                    chat above runs on. */}
                <FilesPanel />
              </div>
            </CopilotKit>
          </div>
        )}
      </div>
    </div>
  );
}
