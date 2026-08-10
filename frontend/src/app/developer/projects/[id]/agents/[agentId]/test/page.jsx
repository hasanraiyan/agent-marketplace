"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowLeft, BotIcon, Loader2, PencilIcon } from "lucide-react";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";
import { getProjectAgents } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.persona.hasanraiyan.me/api/v1";

/**
 * Developer Studio "Test" playground — chat with one of this Project's own
 * Agents to see its actual configured behavior (system prompt, provider,
 * attached Skills/MCPs/Knowledge/Stores, interruptOn) before wiring it into
 * a real integration. Distinct from the Project Agent Architect co-pilot
 * on the edit page, which is a fixed meta-agent for BUILDING an Agent's
 * config via tool calls, not for running the Agent you just built.
 *
 * Backed by a dedicated route (projectAgentTest.controller.js) rather than
 * the Persona-side /api/v1/agui a founder's own agents use — that route
 * only ever builds a PersonaUser execution context from the caller's own
 * Clerk identity, which can't see a Project-owned Agent at all. This page's
 * route explicitly resolves a ProjectAdminContext instead, mirroring the
 * Architect route's own auth (Clerk + projectAdminAuthMiddleware), and
 * verifies the requested Agent actually belongs to this Project before
 * streaming anything.
 */
export default function ProjectAgentTestPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const agentId = params.agentId;
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  useDashboardHeader(
    {
      title: agent?.name || "Test Agent",
      description: "Test session — talks to this Agent's real configuration.",
      leading: (
        <Avatar className="size-8">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} alt="" />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      actions: (
        <div className="flex items-center gap-3">
          <Link
            href={developerRoutes.project(projectId)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <Link href={developerRoutes.projectAgentEdit(projectId, agentId)}>
            <Button variant="outline" size="sm">
              <PencilIcon className="mr-1.5 size-3.5" />
              Edit
            </Button>
          </Link>
        </div>
      ),
    },
    [agent?.name, projectId, agentId],
  );

  // Chat runs over raw fetch (SSE), not the axios `api` instance — needs
  // its own Clerk token, same 40s refresh cadence as the Architect chat.
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
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getProjectAgents(projectId);
        const list = res.data?.data || [];
        const found = list.find((a) => (a._id || a.id) === agentId);
        if (!cancelled) {
          if (found) setAgent(found);
          else toast.error("Agent not found in this Project.");
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load Agent.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, isLoaded, isSignedIn]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="text-primary size-7 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-3">
          <BotIcon className="mx-auto size-10 text-muted-foreground" />
          <h2 className="text-base font-bold">Agent not found</h2>
          <Link href={developerRoutes.project(projectId)}>
            <Button variant="outline">Back to Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  const runtimeUrl = `${BASE_URL}/projects/${projectId}/agents/${agentId}/test/agui`;

  return (
    <div className="@container/main absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {authToken ? (
          <AguiAgentChat
            key={agentId}
            agent={agent}
            url={runtimeUrl}
            agentId={agentId}
            threadId={agentId}
            title={agent.name || "Agent"}
            emptyTitle={`Test ${agent.name || "your agent"}`}
            emptyDescription={
              agent.description ||
              "Send a prompt to see how this Agent behaves with its current configuration."
            }
            className="min-w-0 flex-1"
            showHeader={false}
            headers={{ Authorization: `Bearer ${authToken}` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
