"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Bot, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { getAgent } from "@/lib/api/agents";
import { getThread, getThreadMessages } from "@/lib/api/threads";

export default function ThreadPage() {
  const params = useParams();
  const threadId = params.threadId;
  const { getToken } = useAuth();

  const [thread, setThread] = useState(null);
  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolStatus, setToolStatus] = useState(null);

  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const threadRes = await getThread(threadId);
        const threadData = threadRes.data?.data;
        setThread(threadData);

        const agentRef = threadData?.agentId;
        const agentIdValue =
          typeof agentRef === "string"
            ? agentRef
            : agentRef?._id || agentRef?.id;

        if (agentIdValue) {
          try {
            const agentRes = await getAgent(agentIdValue);
            setAgent(agentRes.data?.data);
          } catch {
            setAgent(null);
          }
        }

        try {
          const msgRes = await getThreadMessages(
            threadData.id || threadData._id,
          );
          setMessages(msgRes.data?.data || []);
        } catch {
          setMessages([]);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Chat not found");
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, toolStatus]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || !thread) return;

    const userMessage = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");
    setToolStatus(null);

    const threadInternalId = thread.id || thread._id;
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const token = await getToken();
    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    try {
      const response = await fetch(
        `${baseURL}/threads/${threadInternalId}/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload);
            if (data.chunk) {
              accumulated += data.chunk;
              setStreamingContent(accumulated);
              setToolStatus(null);
            } else if (data.tool) {
              setToolStatus(data.tool);
            } else if (data.error) {
              toast.error(data.error);
            } else if (data.interrupt) {
              setToolStatus(`Waiting for input: ${data.tool || "..."}`);
            }
          } catch {
            // ignore malformed payloads
          }
        }
      }

      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulated,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Streaming failed");
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setToolStatus(null);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:py-6 px-4 lg:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
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

  return (
    <div className="@container/main flex flex-1 flex-col">
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
            <AvatarImage src={agent?.avatar} alt={agent?.name} />
            <AvatarFallback>
              <Bot className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {thread.title || "New Conversation"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {agent?.name && (
                <>
                  <span className="truncate">{agent.name}</span>
                  <span>•</span>
                </>
              )}
              <Badge variant="outline" className="capitalize">
                {agent?.category || "chat"}
              </Badge>
            </div>
          </div>
          {agent && (
            <Link href={`/dashboard/agents/${agent.id || agent._id}`}>
              <Button variant="outline" size="sm">
                View Agent
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && !streaming ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No messages yet</EmptyTitle>
                <EmptyDescription>
                  Send a message to continue the conversation.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            messages.map((msg, i) => (
              <Message key={i} message={msg} agent={agent} />
            ))
          )}

          {streaming && (
            <div className="flex gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={agent?.avatar} alt={agent?.name} />
                <AvatarFallback>
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-sm font-medium">{agent?.name || "Agent"}</p>
                {toolStatus && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wrench className="size-3.5" />
                    <span>{toolStatus}</span>
                  </div>
                )}
                {streamingContent ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {streamingContent}
                    <span className="ml-0.5 inline-block size-2 animate-pulse bg-foreground" />
                  </div>
                ) : (
                  !toolStatus && (
                    <div className="flex gap-1">
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background px-4 py-4 lg:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <Textarea
              placeholder={`Message ${agent?.name || "agent"}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="max-h-32 min-h-10 resize-none"
              disabled={streaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              size="icon"
            >
              {streaming ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </div>
  );
}

function Message({ message, agent }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        {isUser ? (
          <AvatarFallback>
            <User className="size-4" />
          </AvatarFallback>
        ) : (
          <>
            <AvatarImage src={agent?.avatar} alt={agent?.name} />
            <AvatarFallback>
              <Bot className="size-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium">
          {isUser ? "You" : agent?.name || "Agent"}
        </p>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  );
}
