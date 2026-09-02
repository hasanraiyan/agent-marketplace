"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getProjectRestTools } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { RestApiToolEditor } from "@/components/tools/rest-tool-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * No single-item GET route — same find-by-id-from-list convention as the
 * MCP editor page (mcps/[mcpId]/edit/page.jsx).
 */
export default function ProjectRestToolEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const toolId = params.toolId;
  const isEditing = toolId !== "new";
  const router = useRouter();

  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const res = await getProjectRestTools(projectId);
        const tools = res.data?.data || [];
        const found = tools.find((t) => (t._id || t.id) === toolId);
        if (found) {
          setTool(found);
        } else {
          toast.error("REST API tool not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load tool.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, toolId, isEditing, router]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RestApiToolEditor
      projectId={projectId}
      tool={tool}
      mode={isEditing ? "edit" : "new"}
    />
  );
}
