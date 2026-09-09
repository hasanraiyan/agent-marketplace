"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RobotIcon, SparkleIcon, FolderOpenIcon, TerminalIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getProjectAgents } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";
import { AgentChat } from "@/components/playground/agent-chat";
import { VoiceTab } from "@/components/playground/voice-tab";
import { ArchitectChat } from "@/components/playground/architect-chat";
import { MemoryWorkspaceDialog } from "@/components/playground/memory-workspace-dialog";
import { SandboxTerminalDialog } from "@/components/playground/sandbox-terminal-dialog";
import type { ChatToolCall } from "@/components/chat";

type TabId = "chat" | "voice";

interface AgentRow {
  id: string;
  name: string;
  sandboxEnabled: boolean;
}

// Pseudo-option in the agent picker that selects the "Agent Architect" spec
// bot instead of a real project Agent. Distinct from any Agent id (which are
// Mongo/ObjectIds), so it can never collide with a list row.
const ARCHITECT = "__architect__";

// Same list normalization used across the resource pages: the backend returns
// an array of full docs (or { items }) inside res.data.data.
function normalizeAgents(raw: unknown): AgentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const row = (a ?? {}) as {
        _id?: string;
        id?: string;
        name?: string;
        sandboxEnabled?: boolean;
      };
      const id = row._id ?? row.id;
      return id
        ? { id, name: String(row.name ?? ""), sandboxEnabled: Boolean(row.sandboxEnabled) }
        : null;
    })
    .filter((a): a is AgentRow => a !== null);
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e.response?.data?.message || e.message || fallback;
}

/**
 * Per-agent test surface + the Agent Architect. The picker always leads with
 * "Agent Architect" (selected by default) — a chat-only spec bot that creates
 * and edits the project's Agents by conversation. Choosing a real Agent shows
 * the Chat | Voice test tabs. The Architect surface stays mounted (hidden)
 * while an Agent is selected, so switching back preserves the spec
 * conversation in-session.
 */
function PlaygroundContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const queryAgentId = searchParams.get("agentId") || searchParams.get("agent");

  const [agents, setAgents] = React.useState<AgentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(queryAgentId || ARCHITECT);
  const [tab, setTab] = React.useState<TabId>("chat");
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [toolCalls, setToolCalls] = React.useState<ChatToolCall[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjectAgents(projectId)
      .then((res) => {
        if (cancelled) return;
        const rows = normalizeAgents(res.data?.data);
        setAgents(rows);
        setSelectedId((prev) => {
          if (queryAgentId && rows.some((agent) => agent.id === queryAgentId)) {
            return queryAgentId;
          }
          if (prev === ARCHITECT) return ARCHITECT;
          return prev && rows.some((agent) => agent.id === prev) ? prev : ARCHITECT;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load the project's agents."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, queryAgentId]);

  React.useEffect(() => {
    if (queryAgentId && agents.some((agent) => agent.id === queryAgentId)) {
      setSelectedId(queryAgentId);
    }
  }, [queryAgentId, agents]);

  // Best-effort refresh after the Architect upserts an Agent: drop the agents
  // list page's cached payload, then re-fetch so the new/updated Agent appears
  // in the picker. Selection is preserved (we stay on the Architect).
  const refreshAgents = React.useCallback(() => {
    deleteCachedByPrefix(cacheKey.resource(projectId, "agents"));
    getProjectAgents(projectId)
      .then((res) => setAgents(normalizeAgents(res.data?.data)))
      .catch(() => {
        // list refresh is secondary; the Architect run already succeeded
      });
  }, [projectId]);

  const selectedAgent =
    selectedId && selectedId !== ARCHITECT
      ? (agents.find((agent) => agent.id === selectedId) ?? null)
      : null;
  const showingArchitect = !selectedAgent;
  const selectValue = selectedAgent ? selectedAgent.id : ARCHITECT;

  const handleSelectAgent = (value: string | null) => {
    const next = value === ARCHITECT ? ARCHITECT : value ?? ARCHITECT;
    setSelectedId(next);
    if (next !== ARCHITECT) setTab("chat");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <RobotIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-sm font-semibold tracking-tight">Playground</h1>
            <p className="truncate text-xs text-muted-foreground">
              Test an agent live — or ask the Agent Architect to build one from a description.
            </p>
          </div>
        </div>

        {!loading && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoryOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <FolderOpenIcon className="size-3.5 text-primary" />
              Files
            </Button>

            {selectedAgent?.sandboxEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTerminalOpen(true)}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <TerminalIcon className="size-3.5 text-primary" />
                Terminal
              </Button>
            )}

            <Select
              value={selectValue}
              onValueChange={handleSelectAgent}
              // SelectValue can only show the selected entry's *label* when the
              // root can turn the stored value back into one — without this it
              // falls back to rendering the raw id in the trigger.
              itemToStringLabel={(value) =>
                value === ARCHITECT
                  ? "Agent Architect"
                  : (agents.find((agent) => agent.id === value)?.name ?? String(value ?? ""))
              }
            >
              <SelectTrigger className="w-fit max-w-60">
                <SelectValue placeholder="Select an agent…" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ARCHITECT}>
                  <span className="inline-flex items-center gap-1.5">
                    <SparkleIcon className="size-3.5 text-primary" />
                    Agent Architect
                  </span>
                </SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* No horizontal padding on mobile — AgentChat/ArchitectChat/VoiceTab
          each add their own padding around the messages + composer, so this
          wrapper's padding only stacks with theirs. Left at px-6 that's extra
          dead margin on each side on a phone-width screen on top of what the
          composer itself already adds; sm:px-6 keeps the desktop look. */}
      <div className="flex min-h-0 flex-1 flex-col px-0 py-3 sm:px-6">
        {loading ? (
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-28" />
            <div className="flex flex-1 flex-col gap-2 rounded-none border border-border bg-card p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-6 h-20 w-full" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t load agents</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Architect chat is chat-only; kept mounted while an Agent is
                selected so returning to it preserves the spec conversation. */}
            <div className={showingArchitect ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              <ArchitectChat projectId={projectId} onAgentsRefreshed={refreshAgents} />
            </div>

            {!showingArchitect && selectedAgent && (
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value === "voice" ? "voice" : "chat")}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                <TabsList className="w-fit ml-3 sm:ml-0">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="voice">Voice</TabsTrigger>
                </TabsList>

                {tab === "chat" ? (
                  <TabsContent value="chat" className="min-h-0 flex-1">
                    <AgentChat
                      key={selectedAgent.id}
                      projectId={projectId}
                      agentId={selectedAgent.id}
                      onToolCallsChange={selectedAgent.sandboxEnabled ? setToolCalls : undefined}
                    />
                  </TabsContent>
                ) : (
                  <TabsContent value="voice" className="min-h-0 flex-1">
                    <VoiceTab
                      key={selectedAgent.id}
                      projectId={projectId}
                      agentId={selectedAgent.id}
                    />
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        )}
      </div>

      <MemoryWorkspaceDialog
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        projectId={projectId}
        activeAgentId={selectedAgent?.id}
        agents={agents}
      />

      <SandboxTerminalDialog
        open={terminalOpen}
        onOpenChange={setTerminalOpen}
        toolCalls={toolCalls}
      />
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-col overflow-hidden p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <PlaygroundContent />
    </React.Suspense>
  );
}
