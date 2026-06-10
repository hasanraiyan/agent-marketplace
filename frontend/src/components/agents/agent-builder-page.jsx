"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BotIcon,
  Loader2,
  Play,
  Plug,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentForm } from "@/components/agents/agent-form";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";
import { getAgent, updateAgent, createAgent } from "@/lib/api/agents";
import { getProviders } from "@/lib/api/providers";
import { createThread } from "@/lib/api/threads";
import { useDashboardHeader } from "@/components/dashboard-header-context";

const ARCHITECT_AGENT_ID = "000000000000000000000000";
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

// Architect tool results are JSON strings shaped { status, agentId?, data? }.
// Accept both the standardized top-level agentId and older data-only payloads.
function agentIdFromToolOutput(output) {
  const raw = output?.agentId || output?.data?.id || output?.data?._id;
  return raw ? String(raw) : null;
}

/**
 * Canonical builder workspace shared by the create and edit flows.
 *
 * @param {"create"|"edit"} mode  create: no agent exists yet; the architect or
 *   form creates one and navigates to /dashboard/agents/:id/builder.
 *   edit: loads `agentId` and keeps form/architect/preview in sync.
 */
export function AgentBuilderPage({ mode = "create", agentId = null }) {
  const isEdit = mode === "edit" && Boolean(agentId);
  const router = useRouter();

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState(null);
  const [providers, setProviders] = useState(null);
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
        let providerList = [];
        try {
          const provRes = await getProviders();
          providerList = provRes.data?.data || [];
        } catch (provErr) {
          console.error("Failed to load providers:", provErr);
          toast.error("Failed to load providers");
        }
        setProviders(providerList);

        if (isEdit) {
          try {
            const res = await getAgent(agentId);
            setAgent(res.data?.data);
          } catch (agentErr) {
            console.error("Failed to load agent:", agentErr);
            toast.error(
              agentErr.response?.data?.message ||
                "Failed to load agent details",
            );
          }
        }

        // The architect needs a configured provider to run; skip the thread
        // when there is none so we can show the focused empty state instead.
        if (providerList.length > 0) {
          try {
            const archRes = await createThread({ agentId: ARCHITECT_AGENT_ID });
            setArchitectThread(archRes.data?.data);
          } catch (archErr) {
            console.error("Failed to create architect thread:", archErr);
            toast.error("Failed to connect to Agent Architect");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [agentId, isEdit, isLoaded, isSignedIn]);

  const refreshAgent = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await getAgent(agentId);
      setAgent(res.data?.data);
    } catch (error) {
      console.error("Agent refresh failed", error);
    }
  }, [agentId, isEdit]);

  const refreshPreview = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await createThread({ agentId });
      setPreviewThread(res.data?.data);
    } catch (err) {
      console.error("Preview sync failed", err);
      toast.error("Failed to reset preview");
    }
  }, [agentId, isEdit]);

  useEffect(() => {
    if (isEdit) refreshPreview();
  }, [isEdit, refreshPreview]);

  const startNewArchitectChat = useCallback(async () => {
    const archRes = await createThread({ agentId: ARCHITECT_AGENT_ID });
    setArchitectThread(archRes.data?.data);
  }, []);

  const handleArchitectToolResult = useCallback(
    (tool) => {
      if (
        (tool.name !== "upsert_agent" && tool.name !== "get_agent") ||
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
        if (output?.status !== "success") return;

        const resultAgentId = agentIdFromToolOutput(output);
        if (!resultAgentId) return;

        if (tool.name === "get_agent") {
          // The architect verifies its work with get_agent; mirror that
          // authoritative payload into the form when it is the open agent.
          if (isEdit && resultAgentId === String(agentId) && output.data) {
            setAgent(output.data);
          }
          return;
        }

        if (!isEdit) {
          toast.success("Agent created by Architect");
          router.push(`/dashboard/agents/${resultAgentId}/builder`);
          return;
        }

        refreshAgent().then(() => toast.success("Configuration synced"));
      } catch (error) {
        console.error("Failed to parse architect tool output", error);
      }
    },
    [agentId, isEdit, refreshAgent, router],
  );

  const handleManualSave = async (formData) => {
    setSaving(true);
    try {
      if (isEdit) {
        const res = await updateAgent(agentId, formData);
        setAgent(res.data?.data);
        toast.success("Changes saved");
      } else {
        const res = await createAgent(formData);
        const newAgent = res.data?.data;
        toast.success("Agent created");
        router.push(`/dashboard/agents/${newAgent.id || newAgent._id}/builder`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useDashboardHeader(
    {
      title: agent?.name || "New Agent",
      description:
        activeTab === "configure"
          ? "Configure agent details"
          : activeTab === "preview"
          ? "Test your agent"
          : "Build with Sage",
      leading: (
        <Avatar className="size-8">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      tabs: (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 h-8">
            <TabsTrigger
              value="chat"
              className="h-7 px-3 text-xs lg:hidden data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="configure"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Configure
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
          <Badge
            variant="outline"
            className="h-5 rounded-md py-0 text-[10px] uppercase"
          >
            {isEdit ? agent?.visibility || "private" : "Draft"}
          </Badge>
          {isEdit ? (
            <Link href={`/dashboard/agents/${agentId}/run`}>
              <Button size="sm" className="h-8 rounded-full px-4 font-bold">
                <Play className="mr-1 size-3.5" />
                Run
              </Button>
            </Link>
          ) : null}
        </>
      ),
    },
    [activeTab, agent, agentId, isEdit],
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (providers && providers.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="size-5" />
          </div>
          <h2 className="text-xl font-semibold">Connect a provider first</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Agents need an LLM provider (API key) to run. Add one in settings,
            then come back to build your agent.
          </p>
          <Link href="/dashboard/settings">
            <Button className="rounded-full px-6 font-bold">
              Go to provider settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const architectThreadId = architectThread?._id || architectThread?.id;
  const previewThreadId = previewThread?._id || previewThread?.id;
  const runtimeUrl = AGUI_RUNTIME_URL;

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] max-h-[calc(100vh-var(--header-height))] flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Chat / Architect */}
        <div className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${activeTab === "chat" ? "flex" : "hidden lg:flex"}`}>
          {authToken && architectThreadId ? (
            <AguiAgentChat
              url={runtimeUrl}
              agentId={ARCHITECT_AGENT_ID}
              threadId={architectThreadId}
              title="Sage"
              emptyTitle="Agent Architect"
              emptyDescription={
                isEdit
                  ? "Tell Sage what you want to change about this agent."
                  : "Tell Sage what kind of agent you want to build."
              }
              headers={{
                Authorization: `Bearer ${authToken}`,
                "X-Agent-Id": ARCHITECT_AGENT_ID,
                "X-Thread-Id": architectThreadId,
              }}
              onToolResult={handleArchitectToolResult}
              onNewChat={startNewArchitectChat}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Right Column: Configure & Preview */}
        <div className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 ${activeTab !== "chat" ? "flex" : "hidden lg:flex"}`}>
          <Tabs
            value={activeTab === "chat" ? "configure" : activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Configure Form */}
            <TabsContent
              value="configure"
              className="m-0 min-h-0 flex-1 flex-col data-[state=active]:flex overflow-y-auto p-6 bg-white dark:bg-slate-950"
            >
              <div className="mx-auto max-w-2xl">
                <AgentForm
                  mode={mode}
                  initialData={isEdit ? agent : null}
                  onSave={handleManualSave}
                  loading={saving}
                />
              </div>
            </TabsContent>

            {/* Preview Panel */}
            <TabsContent
              value="preview"
              className="m-0 min-h-0 flex-1 flex-col data-[state=active]:flex overflow-hidden"
            >
              <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 shrink-0">
                <span className="text-sm font-bold">Preview</span>
                {isEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshPreview}
                    title="Reset Preview"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                {isEdit && authToken && previewThreadId ? (
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
                    onNewChat={refreshPreview}
                    showHeader={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900">
                    <div className="max-w-xs space-y-2">
                      <BotIcon className="mx-auto size-12 text-muted-foreground opacity-20" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {isEdit
                          ? "Loading your agent preview..."
                          : "Create your agent with Sage or the Configure form — a live preview unlocks right after."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
