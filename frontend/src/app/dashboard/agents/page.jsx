"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function MyAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch user's agents from /user/agents endpoint
    setLoading(false);
  }, []);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Agents</h1>
            <p className="text-muted-foreground">
              Create and manage your custom AI agents
            </p>
          </div>
          <Link href="/dashboard/agents/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading your agents...</p>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="px-4 lg:px-6">
            <Card className="border-dashed">
              <CardContent className="flex h-96 flex-col items-center justify-center gap-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">No agents yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first AI agent to get started
                  </p>
                </div>
                <Link href="/dashboard/agents/create">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-1">
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {agent.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{agent.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run</span>
                      <span>
                        {agent.lastRun
                          ? new Date(agent.lastRun).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Link href={`/dashboard/agents/${agent.id}/run`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        Run
                      </Button>
                    </Link>
                    <Link href={`/dashboard/agents/${agent.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Delete agent
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
