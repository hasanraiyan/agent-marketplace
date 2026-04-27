"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { CopilotKit } from "@copilotkit/react-core";
import { useAgent } from "@copilotkit/react-core/v2";

import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { getAgent } from "@/lib/api/agents";
import { getThread, getThreadMessages } from "@/lib/api/threads";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const RUNTIME_AGENT_ID = "default";

function normalizeThreadMessage(message, index) {
  const roleMap = {
    human: "user",
    user: "user",
    ai: "assistant",
    assistant: "assistant",
    tool: "tool",
    system: "system",
  };

  const normalizedRole = roleMap[message?.role || message?.type] || "assistant";
  const rawContent = message?.content;
  let content = "";

  if (typeof rawContent === "string") {
    content = rawContent;
  } else if (Array.isArray(rawContent)) {
    content = rawContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof rawContent?.text === "string") {
    content = rawContent.text;
  }

  return {
    id: message?.id || message?.messageId || `thread-message-${index}`,
    role: normalizedRole,
    content,
  };
}

function ThreadHistoryHydrator({ agentId, threadId }) {
  const { agent } = useAgent({ agentId, threadId });
  const [hydratedThreadId, setHydratedThreadId] = useState(null);

  useEffect(() => {
    if (!threadId || !agentId || hydratedThreadId === threadId) {
      return;
    }

    let cancelled = false;

    const hydrateMessages = async () => {
      try {
        const res = await getThreadMessages(threadId);
        const history = (res.data?.data || [])
          .map(normalizeThreadMessage)
          .filter((message) => message.content || message.role === "tool");

        if (!cancelled) {
          agent.setMessages(history);
          setHydratedThreadId(threadId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to hydrate thread history", error);
        }
      }
    };

    hydrateMessages();

    return () => {
      cancelled = true;
    };
  }, [agent, agentId, hydratedThreadId, threadId]);

  return null;
}

export default function ThreadPage() {
  const params = useParams();
  const threadId = params.threadId;
  const { getToken } = useAuth();

  const [thread, setThread] = useState(null);
  const [agent, setAgent] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [threadRes, token] = await Promise.all([getThread(threadId), getToken()]);
        const threadData = threadRes.data?.data;
        setThread(threadData);
        setAuthToken(token);

        const rawAgentRef = threadData?.agentId;
        const resolvedAgentId =
          typeof rawAgentRef === "string"
            ? rawAgentRef
            : rawAgentRef?._id || rawAgentRef?.id || null;

        setAgentId(resolvedAgentId);

        if (resolvedAgentId) {
          try {
            const agentRes = await getAgent(resolvedAgentId);
            setAgent(agentRes.data?.data);
          } catch {
            setAgent(null);
          }
        } else {
          setAgent(null);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Chat not found");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [getToken, threadId]);

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

  if (!thread) {
    return (
      <div className="@container/main flex flex-1 flex-col">
        <div className="px-4 py-6 lg:px-6">
          <Link
            href="/dashboard/chats"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Chats
          </Link>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chat not found</EmptyTitle>
              <EmptyDescription>
                This chat may have been deleted.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const runtimeUrl = `${BASE_URL}/copilotkit`;
  const persistedThreadId = thread?._id || thread?.id || threadId;
  const chatLabels = {
    title: thread.title || agent?.name || "Conversation",
    initial: agent?.description || "How can I help you today?",
    inputPlaceholder: `Message ${agent?.name || "agent"}...`,
  };

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-4 lg:px-6">
        <Link
          href="/dashboard/chats"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Chats
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
              {thread.title || "Conversation"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {agent?.name && <span className="truncate">{agent.name}</span>}
              <Badge variant="outline" className="capitalize">
                {agent?.category || "chat"}
              </Badge>
            </div>
          </div>
          {agentId && (
            <Link href={`/dashboard/agents/${agentId}`}>
              <Button variant="outline" size="sm">
                View Agent
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {authToken && agentId ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CopilotKit
              runtimeUrl={runtimeUrl}
              useSingleEndpoint={false}
              headers={{
                Authorization: `Bearer ${authToken}`,
                "X-Agent-Id": agentId,
                "X-Thread-Id": persistedThreadId,
              }}
            >
              <ThreadHistoryHydrator
                agentId={RUNTIME_AGENT_ID}
                threadId={persistedThreadId}
              />
              <CopilotChat
                threadId={persistedThreadId}
                agentId={RUNTIME_AGENT_ID}
                className="h-full min-h-0"
                labels={chatLabels}
                input={{ bottomAnchored: true }}
                welcomeScreen={false}
                autoScroll="pin-to-bottom"
              />
            </CopilotKit>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                This conversation is missing its agent connection.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
