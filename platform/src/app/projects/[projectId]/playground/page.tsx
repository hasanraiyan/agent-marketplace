"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SparkleIcon, FolderOpenIcon, TerminalIcon, ListIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { HeaderSlot } from "@/components/layout/project-header";
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
import { getProjectAgents, type ProjectAgentThread } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";
import { AgentChat } from "@/components/playground/agent-chat";
import { VoiceTab } from "@/components/playground/voice-tab";
import { ArchitectChat, PROJECT_ARCHITECT_AGENT_ID } from "@/components/playground/architect-chat";
import { MemoryWorkspaceDialog } from "@/components/playground/memory-workspace-dialog";
import { SandboxTerminalDialog } from "@/components/playground/sandbox-terminal-dialog";
import { AgentThreadsSidebar } from "@/components/playground/agent-threads-sidebar";
import type { ChatToolCall } from "@/components/chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
 * Shared "threads sidebar + chat" layout (desktop side-by-side, mobile push
 * slider) — used for both a real Agent's Chat tab and the Architect, which
 * now both support real per-thread history via `AgentThreadsSidebar`. The
 * actual chat surface is a render prop since `AgentChat` and `ArchitectChat`
 * take different props beyond the shared thread-selection plumbing.
 */
function ThreadedChatLayout({
  projectId,
  agentId,
  isMobile,
  threadsOpen,
  setThreadsOpen,
  activeThread,
  setActiveThread,
  latestTitleUpdate,
  renderChat,
}: {
  projectId: string;
  agentId: string;
  isMobile: boolean;
  threadsOpen: boolean;
  setThreadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeThread: ProjectAgentThread | null;
  setActiveThread: (thread: ProjectAgentThread | null) => void;
  latestTitleUpdate: { threadId: string; title: string } | null;
  renderChat: () => React.ReactNode;
}) {
  const activeThreadId = activeThread?._id || activeThread?.threadId || null;

  const handleThreadDeleted = (deletedId: string) => {
    if (activeThread?._id === deletedId) setActiveThread(null);
  };

  if (!isMobile) {
    return (
      <div className="flex h-full min-h-0 w-full gap-3 overflow-hidden rounded-md border border-border/40 bg-background">
        {threadsOpen && (
          <AgentThreadsSidebar
            projectId={projectId}
            agentId={agentId}
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThread}
            onThreadDeleted={handleThreadDeleted}
            updatedTitle={latestTitleUpdate}
          />
        )}
        <div className="flex-1 min-w-0 h-full">{renderChat()}</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-md border border-border/40 bg-background">
      <div
        className={cn(
          "flex h-full w-full transition-transform duration-300 ease-in-out",
          threadsOpen ? "translate-x-0" : "-translate-x-[260px]"
        )}
      >
        <div className="w-[260px] shrink-0 h-full">
          <AgentThreadsSidebar
            projectId={projectId}
            agentId={agentId}
            activeThreadId={activeThreadId}
            onSelectThread={(thread) => {
              setActiveThread(thread);
              setThreadsOpen(false);
            }}
            onThreadDeleted={handleThreadDeleted}
            updatedTitle={latestTitleUpdate}
            onClose={() => setThreadsOpen(false)}
            className="w-full h-full"
          />
        </div>

        <div className="relative w-full min-w-full shrink-0 h-full">
          {threadsOpen && (
            <div
              onClick={() => setThreadsOpen(false)}
              className="absolute inset-0 z-20 cursor-pointer bg-background/20 backdrop-blur-[1px]"
              title="Tap to close threads"
            />
          )}
          {renderChat()}
        </div>
      </div>
    </div>
  );
}

/**
 * Per-agent test surface + the Agent Architect. The picker always leads with
 * "Agent Architect" (selected by default) — a chat-only spec bot that creates
 * and edits the project's Agents by conversation. Choosing a real Agent shows
 * the Chat | Voice test tabs. The Architect surface stays mounted (hidden)
 * while an Agent is selected, so switching back preserves the spec
 * conversation in-session. Both the Architect and a real Agent's Chat tab now
 * get the same real thread-history sidebar (ThreadedChatLayout) and Memory
 * workspace access.
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
  const [openFilePath, setOpenFilePath] = React.useState<string | null>(null);
  const [liveWorkspaceFiles, setLiveWorkspaceFiles] = React.useState<
    Record<string, { content: string; size: number; createdAt: string | null; modifiedAt: string | null }>
  >({});
  const isMobile = useIsMobile();
  const [threadsOpen, setThreadsOpen] = React.useState(true);
  const [activeThread, setActiveThread] = React.useState<ProjectAgentThread | null>(null);
  const [latestTitleUpdate, setLatestTitleUpdate] = React.useState<{
    threadId: string;
    title: string;
  } | null>(null);

  // Default threads drawer to closed on mobile screens
  React.useEffect(() => {
    if (isMobile) {
      setThreadsOpen(false);
    }
  }, [isMobile]);

  const activeThreadRef = React.useRef(activeThread);
  React.useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  const handleTitleGenerated = React.useCallback((newTitle: string) => {
    setActiveThread((prev) => (prev ? { ...prev, title: newTitle } : null));
    const currentId = activeThreadRef.current?._id || activeThreadRef.current?.threadId;
    if (currentId) {
      setLatestTitleUpdate({ threadId: currentId, title: newTitle });
    }
  }, []);

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
    setActiveThread(null);
    setLatestTitleUpdate(null);
    setLiveWorkspaceFiles({});
    if (next !== ARCHITECT) setTab("chat");
  };

  // present_file's Open button — jump the Files dialog straight to that path.
  const handleOpenFile = React.useCallback((path: string) => {
    setOpenFilePath(path);
    setMemoryOpen(true);
  }, []);

  // Memory workspace's own agent-name lookup (`agents.find(...)`) has no
  // entry for the Architect sentinel — it isn't a real Project Agent, so it
  // never appears in the fetched `agents` list. Add one synthetic row purely
  // for that lookup so the dialog's agent-name badge resolves instead of
  // showing blank; it's never used for anything else (not the picker, not
  // sandbox/terminal logic).
  const memoryDialogAgents = React.useMemo(
    () => [{ id: PROJECT_ARCHITECT_AGENT_ID, name: "Agent Architect", sandboxEnabled: false }, ...agents],
    [agents]
  );
  const memoryActiveAgentId = showingArchitect ? PROJECT_ARCHITECT_AGENT_ID : selectedAgent?.id;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!loading && (
        <>
          <HeaderSlot side="left">
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
              <SelectContent align="start">
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
          </HeaderSlot>

          <HeaderSlot side="right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoryOpen(true)}
              className="h-8 gap-1.5 px-2 text-xs font-medium md:px-3"
            >
              <FolderOpenIcon className="size-3.5 text-primary" />
              <span className="hidden md:inline">Files</span>
            </Button>

            {selectedAgent?.sandboxEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTerminalOpen(true)}
                className="h-8 gap-1.5 px-2 text-xs font-medium md:px-3"
              >
                <TerminalIcon className="size-3.5 text-primary" />
                <span className="hidden md:inline">Terminal</span>
              </Button>
            )}
          </HeaderSlot>
        </>
      )}

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

            {/* Architect: chat-only (no Voice tab), but now gets the same
                Threads sidebar a real Agent's Chat tab has. Kept mounted
                while an Agent is selected so returning to it preserves the
                spec conversation. */}
            <div className={showingArchitect ? "flex min-h-0 flex-1 flex-col gap-2" : "hidden"}>
              <div className="flex items-center gap-2 ml-3 sm:ml-0">
                <Button
                  variant={threadsOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setThreadsOpen((prev) => !prev)}
                  className="h-8 w-8 p-0"
                  title={threadsOpen ? "Collapse threads" : "Show threads"}
                >
                  <ListIcon className="size-4" />
                </Button>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <SparkleIcon className="size-3.5 text-primary" />
                  Agent Architect
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <ThreadedChatLayout
                  projectId={projectId}
                  agentId={PROJECT_ARCHITECT_AGENT_ID}
                  isMobile={isMobile}
                  threadsOpen={threadsOpen}
                  setThreadsOpen={setThreadsOpen}
                  activeThread={activeThread}
                  setActiveThread={setActiveThread}
                  latestTitleUpdate={latestTitleUpdate}
                  renderChat={() => (
                    <ArchitectChat
                      key={activeThread?.threadId || activeThread?._id || "default"}
                      projectId={projectId}
                      threadId={activeThread?.threadId || activeThread?._id}
                      onAgentsRefreshed={refreshAgents}
                      onTitleGenerated={handleTitleGenerated}
                    />
                  )}
                />
              </div>
            </div>

            {!showingArchitect && selectedAgent && (
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value === "voice" ? "voice" : "chat")}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                <div className="flex items-center gap-2 ml-3 sm:ml-0">
                  {tab === "chat" && (
                    <Button
                      variant={threadsOpen ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setThreadsOpen((prev) => !prev)}
                      className="h-8 w-8 p-0"
                      title={threadsOpen ? "Collapse threads" : "Show threads"}
                    >
                      <ListIcon className="size-4" />
                    </Button>
                  )}
                  <TabsList className="w-fit">
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="voice">Voice</TabsTrigger>
                  </TabsList>
                </div>

                {tab === "chat" ? (
                  <TabsContent value="chat" className="min-h-0 flex-1">
                    <ThreadedChatLayout
                      projectId={projectId}
                      agentId={selectedAgent.id}
                      isMobile={isMobile}
                      threadsOpen={threadsOpen}
                      setThreadsOpen={setThreadsOpen}
                      activeThread={activeThread}
                      setActiveThread={setActiveThread}
                      latestTitleUpdate={latestTitleUpdate}
                      renderChat={() => (
                        <AgentChat
                          key={`${selectedAgent.id}-${activeThread?._id || activeThread?.threadId || "default"}`}
                          projectId={projectId}
                          agentId={selectedAgent.id}
                          threadId={activeThread?.threadId || activeThread?._id}
                          onToolCallsChange={selectedAgent.sandboxEnabled ? setToolCalls : undefined}
                          onOpenFile={handleOpenFile}
                          onWorkspaceFilesChange={setLiveWorkspaceFiles}
                          onTitleGenerated={handleTitleGenerated}
                        />
                      )}
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
        onOpenChange={(next) => {
          setMemoryOpen(next);
          if (!next) setOpenFilePath(null);
        }}
        projectId={projectId}
        activeAgentId={memoryActiveAgentId}
        agents={memoryDialogAgents}
        initialOpenPath={openFilePath}
        liveWorkspaceFiles={liveWorkspaceFiles}
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
