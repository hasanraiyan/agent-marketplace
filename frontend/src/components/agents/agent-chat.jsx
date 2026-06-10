"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Send, Loader2, Bot, User, Wrench, BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { getThreadMessages } from "@/lib/api/threads";

export function AgentChat({
  agent,
  thread,
  onMessageSent,
  placeholder,
  showHeader = false,
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolStatus, setToolStatus] = useState(null);

  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  const threadId = thread?.id || thread?._id;

  useEffect(() => {
    if (threadId) {
      const loadMessages = async () => {
        setLoading(true);
        try {
          const res = await getThreadMessages(threadId);
          setMessages(res.data?.data || []);
        } catch (err) {
          setMessages([]);
        } finally {
          setLoading(false);
        }
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, toolStatus]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || !threadId) return;

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

    const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const token = await getToken();
    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    try {
      const response = await fetch(`${baseURL}/threads/${threadId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

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
              // Only clear tool status once we get actual content back
              setToolStatus(null);
            } else if (data.tool) {
              setToolStatus(data.tool);
              if (onMessageSent)
                onMessageSent({ type: "tool", name: data.tool });
            } else if (data.tool_output) {
              if (onMessageSent)
                onMessageSent({
                  type: "tool_output",
                  name: data.tool,
                  output: data.tool_output,
                });
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
        const assistantMsg = {
          role: "assistant",
          content: accumulated,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (onMessageSent)
          onMessageSent({ type: "message", message: assistantMsg });
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

  return (
    <div className="flex h-full flex-col bg-background">
      {showHeader && agent && (
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Avatar className="size-8">
            <AvatarImage
              src={agent.avatarUrl || agent.avatar}
              alt={agent.name}
            />
            <AvatarFallback>
              <BotIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span className="font-bold">{agent.name}</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-6">
          {messages.map((msg, i) => (
            <Message key={i} message={msg} agent={agent} />
          ))}

          {streaming && (
            <div className="flex gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarImage
                  src={agent?.avatarUrl || agent?.avatar}
                  alt={agent?.name}
                />
                <AvatarFallback>
                  <BotIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {toolStatus && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                    <Wrench className="size-3.5 animate-pulse" />
                    <span>Using {toolStatus}...</span>
                  </div>
                )}
                {streamingContent ? (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                    >
                      {streamingContent}
                    </ReactMarkdown>
                    <span className="ml-0.5 inline-block size-2 animate-pulse bg-foreground" />
                  </div>
                ) : (
                  !toolStatus && (
                    <div className="flex gap-1 py-2">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur-sm">
        <div className="relative flex items-end gap-2">
          <Textarea
            placeholder={placeholder || `Message ${agent?.name || "agent"}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="max-h-32 min-h-11 resize-none bg-muted/30 focus-visible:bg-background"
            disabled={streaming || !threadId}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || streaming || !threadId}
            size="icon"
            className="size-11 shrink-0"
          >
            {streaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Message({ message, agent }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="size-8 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
            YOU
          </AvatarFallback>
        ) : (
          <>
            <AvatarImage
              src={agent?.avatarUrl || agent?.avatar}
              alt={agent?.name}
            />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <Bot className="size-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div
        className={`flex min-w-0 max-w-[85%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed prose prose-sm max-w-none ${
            isUser
              ? "prose-invert bg-primary text-primary-foreground rounded-tr-none"
              : "dark:prose-invert bg-muted text-foreground rounded-tl-none"
          } prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
