"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  Settings2, 
  MessageSquare, 
  Play,
  Save,
  BotIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

import { getAgent, updateAgent, createAgent } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";
import { AgentChat } from "@/components/agents/agent-chat";
import { AgentForm } from "@/components/agents/agent-form";

const ARCHITECT_AGENT_ID = '000000000000000000000000';

export default function BuilderPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id; // May be undefined for "create"

  const { isLoaded, isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(!!agentId);
  const [saving, setSaving] = useState(false);
  
  const [agent, setAgent] = useState(null);
  const [architectThread, setArchitectThread] = useState(null);
  const [previewThread, setPreviewThread] = useState(null);

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

  // 3. Handle Architect Tool Calls (Syncing builder with agent state)
  const handleArchitectEvent = async (event) => {
    // If architect calls upsert_agent, we should re-fetch our agent data
    if (event.type === 'tool' && event.name === 'upsert_agent') {
        // The architect might have returned JSON in the message history or we need to wait
        // for the message to be finalized. 
        // For simplicity, we trigger a refresh after the tool finishes.
        setTimeout(async () => {
            try {
                // If we are in "create" mode, we don't have an ID yet.
                // We should check the response of the tool if possible, or just refresh list.
                if (agentId) {
                    const res = await getAgent(agentId);
                    setAgent(res.data?.data);
                } else {
                    // Logic to find the newly created agent by this user if just created
                    // Better: The Architect now returns JSON. If we could parse it from the streaming history...
                    // For now, let's just refresh the whole page if we detect a creation.
                    // (The component will re-mount and find the new ID if we redirect)
                }
            } catch (e) {
                console.error("Sync failed");
            }
        }, 2000);
    }
  };

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
                disabled={saving || !agent}
            >
                {saving ? "Saving..." : agentId ? "Update" : "Create"}
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
                    <AgentChat 
                        agent={{ name: "Agent Architect", avatar: "" }}
                        thread={architectThread}
                        onMessageSent={handleArchitectEvent}
                        placeholder="Say something like 'make a creative writing assistant'..."
                    />
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
                {agentId ? (
                    <AgentChat 
                        agent={agent}
                        thread={previewThread}
                        placeholder={`Message ${agent?.name || "agent"}...`}
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
