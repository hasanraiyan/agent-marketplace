"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import { getProjectWorkflow } from "@/lib/api/projects";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react";

export default function WorkflowEditorPage() {
  const { projectId, workflowId } = useParams<{
    projectId: string;
    workflowId: string;
  }>();

  const [workflow, setWorkflow] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadWorkflow = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getProjectWorkflow(projectId, workflowId);
      setWorkflow(res.data?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId]);

  React.useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-65px)] w-full items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex h-[calc(100vh-65px)] w-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-destructive">{error || "Workflow not found"}</p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/projects/${projectId}/workflows`} />}
          className="gap-1.5"
        >
          <ArrowLeftIcon className="size-4" />
          <span>Back to Workflows</span>
        </Button>
      </div>
    );
  }

  return (
    <WorkflowCanvas
      projectId={projectId}
      workflow={workflow}
      onRefresh={loadWorkflow}
    />
  );
}
