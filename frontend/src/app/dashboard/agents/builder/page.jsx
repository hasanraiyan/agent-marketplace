"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BotIcon, Loader2, Play } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentForm } from "@/components/agents/agent-form";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";
import { getAgent, updateAgent, createAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";

const ARCHITECT_AGENT_ID = "000000000000000000000000";
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

export default function BuilderPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(Boolean(agentId));
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState(null);
  const [architectThread, setArchitectThread] = useState(null);
  const [previewThread, setPreviewThread] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const handledArchitectTools = useRef(new Set());

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

    const init = async () => {
      try {
        if (agentId) {
          try {
            const res = await getAgent(agentId);
            setAgent(res.data?.data);
          } catch (agentErr) {
            console.error("Failed to load agent:", agentErr);
            toast.error("Failed to load agent details");
          }
        }

        try {
          const archRes = await createThread({ agentId: ARCHITECT_AGENT_ID });
          setArchitectThread(archRes.data?.data);
        } catch (archErr) {
          console.error("Failed to create architect thread:", archErr);
          toast.error("Failed to connect to Agent Architect");
        }
      } catch (err) {
        console.error("Critical builder initialization failure:", err);
        toast.error(
          `Initialization failed: ${err.response?.data?.message || err.message}`,
        );
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [agentId, isLoaded, isSignedIn]);

  const refreshPreview = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await createThread({ agentId });
      setPreviewThread(res.data?.data);
    } catch (err) {
      console.error("Preview sync failed", err);
    }
  }, [agentId]);

  useEffect(() => {
    if (agentId) refreshPreview();
  }, [agentId, refreshPreview]);

  const handleArchitectCreated = useCallback(
    (newAgentId) => {
      toast.success("Agent created by Architect");
      router.push(`/dashboard/agents/${newAgentId}/builder`);
    },
    [router],
  );

  const handleArchitectUpdated = useCallback(async (updatedAgentId) => {
    try {
      const res = await getAgent(updatedAgentId);
      setAgent(res.data?.data);
      toast.success("Configuration synced");
    } catch (error) {
      console.error("Sync failed", error);
    }
  }, []);

  const handleArchitectToolResult = useCallback(
    (tool) => {
      if (
        tool.name !== "upsert_agent" ||
        handledArchitectTools.current.has(tool.id)
      ) {
        return;
      }

      handledArchitectTools.current.add(tool.id);

      try {
        const output =
          typeof tool.resultText === "string"
            ? JSON.parse(tool.resultText)
            : tool.resultText;
        if (output?.status !== "success" || !output?.agentId) return;

        if (!agentId) {
          handleArchitectCreated(output.agentId);
          return;
        }

        handleArchitectUpdated(output.agentId);
      } catch (error) {
        console.error("Failed to parse architect tool output", error);
      }
    },
    [agentId, handleArchitectCreated, handleArchitectUpdated],
  );

  const handleManualSave = async (formData) => {
    setSaving(true);
    try {
      if (agentId) {
        const res = await updateAgent(agentId, formData);
        setAgent(res.data?.data);
        toast.success("Changes saved");
      } else {
        const res = await createAgent(formData);
        const newAgent = res.data?.data;
        toast.success("Agent created");
        router.push(`/dashboard/agents/${newAgent.id || newAgent._id}/builder`);
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const architectThreadId = architectThread?._id || architectThread?.id;
  const previewThreadId = previewThread?._id || previewThread?.id;
  const runtimeUrl = AGUI_RUNTIME_URL;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarImage src={agent?.avatarUrl || agent?.avatar} />
              <AvatarFallback>
                <BotIcon className="size-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-bold">
              {agent?.name || "New Agent"}
            </span>
            <Badge
              variant="outline"
              className="h-5 rounded-md py-0 text-[10px] uppercase"
            >
              Draft
            </Badge>
          </div>
        </div>

        <Button
          size="sm"
          className="h-8 rounded-full px-4 font-bold"
          onClick={() => handleManualSave(agent)}
          disabled={saving || !agent || activeTab === "configure"}
        >
          {saving
            ? "Saving..."
            : activeTab === "configure"
              ? "Use form below"
              : agentId
                ? "Update"
                : "Create"}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex justify-center border-b border-slate-200 bg-slate-50 py-1 dark:border-slate-800 dark:bg-slate-900">
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="create"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
                >
                  Create
                </TabsTrigger>
                <TabsTrigger
                  value="configure"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
                >
                  Configure
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="create"
              className="m-0 min-h-0 flex-1 overflow-hidden"
            >
              {authToken && architectThreadId ? (
                <AguiAgentChat
                  url={runtimeUrl}
                  agentId={ARCHITECT_AGENT_ID}
                  threadId={architectThreadId}
                  title="Sage"
                  emptyTitle="Agent Architect"
                  emptyDescription="Tell Sage what kind of agent you want to build."
                  headers={{
                    Authorization: `Bearer ${authToken}`,
                    "X-Agent-Id": ARCHITECT_AGENT_ID,
                    "X-Thread-Id": architectThreadId,
                  }}
                  onToolResult={handleArchitectToolResult}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="configure"
              className="m-0 min-h-0 flex-1 overflow-y-auto p-6"
            >
              <div className="mx-auto max-w-2xl">
                <AgentForm
                  initialData={agent}
                  onSave={handleManualSave}
                  loading={saving}
                  hideHeader
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 lg:flex dark:bg-slate-900">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-sm font-bold">Preview</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshPreview}
              title="Reset Preview"
            >
              <Play className="size-3.5 rotate-90" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {agentId && authToken && previewThreadId ? (
              <AguiAgentChat
                agent={agent}
                url={runtimeUrl}
                agentId={agentId}
                threadId={previewThreadId}
                title={agent?.name || "Agent preview"}
                emptyTitle={agent?.name || "Agent preview"}
                emptyDescription={
                  agent?.description || "Test your agent before sharing it."
                }
                headers={{
                  Authorization: `Bearer ${authToken}`,
                  "X-Agent-Id": agentId,
                  "X-Thread-Id": previewThreadId,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div className="max-w-xs space-y-2">
                  <BotIcon className="mx-auto size-12 text-muted-foreground opacity-20" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Your agent preview will appear here once you start building.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
