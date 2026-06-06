"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Play,
  BotIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { z } from "zod";
import { defineToolCallRenderer } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { getAgent, updateAgent, createAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";
import { AgentForm } from "@/components/agents/agent-form";
import { baseToolRenderers } from "@/lib/copilotkit/tool-renderers";

const ARCHITECT_AGENT_ID = "000000000000000000000000";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

function ArchitectToolSync({ toolCallId, status, result, mode, currentAgentId, onCreated, onUpdated }) {
  const handledToolCalls = useRef(new Set());

  useEffect(() => {
    if (status !== "complete" || !result || handledToolCalls.current.has(toolCallId)) {
      return;
    }

    handledToolCalls.current.add(toolCallId);

    try {
      const output = typeof result === "string" ? JSON.parse(result) : result;
      if (output?.status !== "success" || !output?.agentId) {
        return;
      }

      if (mode === "create" && !currentAgentId) {
        onCreated(output.agentId);
        return;
      }

      onUpdated(output.agentId);
    } catch (error) {
      console.error("Failed to parse architect tool output", error);
    }
  }, [currentAgentId, mode, onCreated, onUpdated, result, status, toolCallId]);

  return null;
}

export default function BuilderPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id; // May be undefined for "create"

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(!!agentId);
  const [saving, setSaving] = useState(false);
  
  const [agent, setAgent] = useState(null);
  const [architectThread, setArchitectThread] = useState(null);
  const [previewThread, setPreviewThread] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Periodically refresh the auth token to prevent expiration (Clerk tokens expire in 60s)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const refreshToken = async () => {
      try {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 40000); // refresh every 40 seconds
    return () => clearInterval(interval);
  }, [getToken, isLoaded, isSignedIn]);

  // 1. Initial Load: Agent Data (if edit) and Architect Thread
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const init = async () => {
      try {
        // Load agent if editing
        if (agentId) {
          try {
            const res = await getAgent(agentId);
            setAgent(res.data?.data);
          } catch (agentErr) {
            console.error("Failed to load agent:", agentErr);
            toast.error("Failed to load agent details");
          }
        }

        // Always create a thread with the Architect
        try {
            const archRes = await createThread({ agentId: ARCHITECT_AGENT_ID });
            setArchitectThread(archRes.data?.data);
        } catch (archErr) {
            console.error("Failed to create architect thread:", archErr);
            toast.error("Failed to connect to Agent Architect");
        }
      } catch (err) {
        console.error("Critical builder initialization failure:", err);
        toast.error("Initialization failed: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [agentId, isLoaded, isSignedIn]);

  // 2. Preview Thread Management: Re-create when agent config changes significantly (like system prompt)
  const refreshPreview = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await createThread({ agentId });
      setPreviewThread(res.data?.data);
    } catch (err) {
      console.error("Preview sync failed");
    }
  }, [agentId]);

  useEffect(() => {
    if (agentId) refreshPreview();
  }, [agentId, refreshPreview]);

  const handleArchitectCreated = useCallback((newAgentId) => {
    toast.success("Agent created by Architect");
    router.push(`/dashboard/agents/${newAgentId}/builder`);
  }, [router]);

  const handleArchitectUpdated = useCallback(async (updatedAgentId) => {
    try {
      const res = await getAgent(updatedAgentId);
      setAgent(res.data?.data);
      toast.success("Configuration synced");
    } catch (error) {
      console.error("Sync failed", error);
    }
  }, []);

  const architectToolRenderers = useMemo(() => [
    defineToolCallRenderer({
      name: "upsert_agent",
      args: z.any(),
      render: ({ toolCallId, status, result }) => (
        <ArchitectToolSync
          toolCallId={toolCallId}
          status={status}
          result={result}
          mode={agentId ? "edit" : "create"}
          currentAgentId={agentId}
          onCreated={handleArchitectCreated}
          onUpdated={handleArchitectUpdated}
        />
      ),
    }),
    // The architect also uses the deepagents built-ins (todos, filesystem,
    // subagents) and search_web — share the same renderers as every surface.
    ...baseToolRenderers,
  ], [agentId, handleArchitectCreated, handleArchitectUpdated]);

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
    } catch (err) {
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
  const runtimeUrl = `${BASE_URL}/copilotkit`;
  const architectLabels = {
    title: "Agent Architect",
    initial: "Tell me what kind of agent you want to build.",
    inputPlaceholder: "Say something like 'make a creative writing assistant'...",
  };
  const previewLabels = {
    title: agent?.name || "Agent",
    initial: agent?.description || "How can I help you today?",
    inputPlaceholder: `Message ${agent?.name || "agent"}...`,
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={agent?.avatarUrl || agent?.avatar} />
              <AvatarFallback><BotIcon className="size-3" /></AvatarFallback>
            </Avatar>
            <span className="text-sm font-bold">{agent?.name || "New Agent"}</span>
            <Badge variant="outline" className="text-[10px] py-0 h-4 uppercase opacity-50">Draft</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Button 
                size="sm" 
                variant="primary" 
                className="h-8 px-4 font-bold"
                onClick={() => handleManualSave(agent)}
                disabled={saving || !agent || activeTab === 'configure'}
            >
                {saving ? "Saving..." : activeTab === 'configure' ? "Use form below" : agentId ? "Update" : "Create"}
            </Button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Builder / Config */}
        <div className="flex flex-1 flex-col border-r overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex justify-center border-b bg-muted/20 py-1">
                    <TabsList className="bg-transparent">
                        <TabsTrigger value="create" className="data-[state=active]:bg-background">Create</TabsTrigger>
                        <TabsTrigger value="configure" className="data-[state=active]:bg-background">Configure</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="create" className="m-0 flex-1 overflow-hidden">
                    {authToken && architectThreadId ? (
                      <CopilotKit
                        runtimeUrl={runtimeUrl}
                        useSingleEndpoint={false}
                        headers={{
                          Authorization: `Bearer ${authToken}`,
                          "X-Agent-Id": ARCHITECT_AGENT_ID,
                          "X-Thread-Id": architectThreadId,
                        }}
                        renderToolCalls={architectToolRenderers}
                      >
                        <CopilotChat
                          agentId={ARCHITECT_AGENT_ID}
                          threadId={architectThreadId}
                          className="h-full min-h-0"
                          labels={architectLabels}
                          welcomeScreen={false}
                          autoScroll="pin-to-bottom"
                        />
                      </CopilotKit>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                </TabsContent>

                <TabsContent value="configure" className="m-0 flex-1 overflow-y-auto p-6 scrollbar-hide">
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

        {/* Right Pane: Preview */}
        <div className="hidden flex-1 flex-col lg:flex overflow-hidden bg-muted/5">
            <div className="flex h-12 items-center justify-between border-b px-4 bg-background">
                <span className="text-sm font-bold">Preview</span>
                <Button variant="ghost" size="icon-sm" onClick={refreshPreview} title="Reset Preview">
                    <Play className="size-3.5 rotate-90" />
                </Button>
            </div>
            
            <div className="flex-1 overflow-hidden">
                {agentId && authToken && previewThreadId ? (
                    <CopilotKit
                      runtimeUrl={runtimeUrl}
                      useSingleEndpoint={false}
                      headers={{
                        Authorization: `Bearer ${authToken}`,
                        "X-Agent-Id": agentId,
                        "X-Thread-Id": previewThreadId,
                      }}
                      renderToolCalls={baseToolRenderers}
                    >
                      <CopilotChat
                        agentId={agentId}
                        threadId={previewThreadId}
                        className="h-full min-h-0"
                        labels={previewLabels}
                        welcomeScreen={false}
                        autoScroll="pin-to-bottom"
                      />
                    </CopilotKit>
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
