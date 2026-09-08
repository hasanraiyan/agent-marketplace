"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RobotIcon } from "@phosphor-icons/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getProjectAgents } from "@/lib/api/projects";
import { AgentChat } from "@/components/playground/agent-chat";
import { VoiceTab } from "@/components/playground/voice-tab";

type TabId = "chat" | "voice";

interface AgentRow {
  id: string;
  name: string;
}

// Same list normalization used across the resource pages: the backend returns
// an array of full docs (or { items }) inside res.data.data.
function normalizeAgents(raw: unknown): AgentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const row = (a ?? {}) as { _id?: string; id?: string; name?: string };
      const id = row._id ?? row.id;
      return id ? { id, name: String(row.name ?? "") } : null;
    })
    .filter((a): a is AgentRow => a !== null);
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e.response?.data?.message || e.message || fallback;
}

/**
 * Live per-agent test surface. Replaces the old static mock gallery: pick an
 * Agent, then talk to it over AG-UI text chat or voice. Only the active tab is
 * mounted — switching tabs tears the other session down (useVoiceSession stops
 * its WebSocket on unmount), and switching agents remounts a fresh chat via
 * key.
 */
export default function PlaygroundPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [agents, setAgents] = React.useState<AgentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabId>("chat");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjectAgents(projectId)
      .then((res) => {
        if (cancelled) return;
        const rows = normalizeAgents(res.data?.data);
        setAgents(rows);
        setSelectedId((prev) =>
          prev && rows.some((agent) => agent.id === prev) ? prev : (rows[0]?.id ?? null)
        );
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
  }, [projectId]);

  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  const handleSelectAgent = (value: string | null) => {
    setSelectedId(value);
    setTab("chat");
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
              Talk to a project agent live — same tools and knowledge it runs with.
            </p>
          </div>
        </div>

        {!loading && agents.length > 0 && (
          <Select
            value={selectedId ?? ""}
            onValueChange={handleSelectAgent}
            // SelectValue can only show the selected agent's *name* when the
            // root can turn the stored id back into a label — without this it
            // falls back to rendering the raw id in the trigger.
            itemToStringLabel={(value) =>
              agents.find((agent) => agent.id === value)?.name ?? String(value ?? "")
            }
          >
            <SelectTrigger className="w-fit max-w-60">
              <SelectValue placeholder="Select an agent…" />
            </SelectTrigger>
            <SelectContent align="end">
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-3">
        {loading ? (
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-28" />
            <div className="flex flex-1 flex-col gap-2 rounded-none border border-border bg-card p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-6 h-20 w-full" />
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-auto w-full">
            <AlertTitle>Couldn't load agents</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : agents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="flex size-10 items-center justify-center rounded-none bg-muted text-muted-foreground">
              <RobotIcon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">No agents yet</h2>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create an Agent for this project and it will show up here, ready to test over
                chat or voice.
              </p>
            </div>
            <Button size="sm" render={<Link href={`/projects/${projectId}/agents/new`} />}>
              Create an agent
            </Button>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value === "voice" ? "voice" : "chat")}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <TabsList className="w-fit">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="voice">Voice</TabsTrigger>
            </TabsList>

            {tab === "chat" ? (
              <TabsContent value="chat" className="min-h-0 flex-1">
                {selected ? (
                  <AgentChat key={selected.id} projectId={projectId} agentId={selected.id} />
                ) : null}
              </TabsContent>
            ) : (
              <TabsContent value="voice" className="min-h-0 flex-1">
                {selected ? (
                  <VoiceTab key={selected.id} projectId={projectId} agentId={selected.id} />
                ) : null}
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
