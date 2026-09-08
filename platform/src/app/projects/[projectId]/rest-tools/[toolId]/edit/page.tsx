"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectRestTools } from "@/lib/api/projects";
import { RestApiToolEditor } from "@/components/rest-tools/rest-tool-editor";

interface RestApiTool {
  _id?: string;
  id?: string;
  name: string;
  method: string;
  url: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function EditRestToolPage() {
  const { projectId, toolId } = useParams<{ projectId: string; toolId: string }>();
  const [tool, setTool] = React.useState<RestApiTool | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const loading = loadedFor !== toolId;

  // No single-item GET route — same find-by-id-from-list convention as the
  // platform's MCP editor. Loading is derived from which toolId has been
  // fetched (loadedFor !== toolId), so no setState is needed synchronously.
  React.useEffect(() => {
    let cancelled = false;
    getProjectRestTools(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: RestApiTool[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((t) => (t.id ?? t._id) === toolId);
        setLoadError(null);
        if (!found) {
          setLoadError("REST API tool not found.");
        } else {
          setTool(found);
        }
        setLoadedFor(toolId);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(errorMessage(err, "Failed to load tool."));
          setLoadedFor(toolId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, toolId]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    );
  }

  if (loadError || !tool) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>REST API tool not found</CardTitle>
            <CardDescription>{loadError ?? "This tool does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/rest-tools`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to REST Tools
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RestApiToolEditor projectId={projectId} tool={tool} mode="edit" />;
}