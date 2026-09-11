"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockCounterClockwiseIcon,
  TreeStructureIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  ArrowsClockwiseIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjectWorkflow, getProjectWorkflowRuns } from "@/lib/api/projects";

export default function WorkflowRunsPage() {
  const { projectId, workflowId } = useParams<{
    projectId: string;
    workflowId: string;
  }>();

  const [workflow, setWorkflow] = React.useState<any | null>(null);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [includeDryRuns, setIncludeDryRuns] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [wfRes, runsRes] = await Promise.all([
        getProjectWorkflow(projectId, workflowId),
        getProjectWorkflowRuns(projectId, workflowId, {
          isDryRun: includeDryRuns ? undefined : false,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }),
      ]);
      setWorkflow(wfRes.data?.data || null);
      setRuns(runsRes.data?.data?.items || runsRes.data?.data || []);
      setTotal(runsRes.data?.data?.pagination?.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId, includeDryRuns, statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 gap-1 font-mono text-[10px]">
            <CheckCircleIcon className="size-3" weight="fill" />
            <span>completed</span>
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500/30 gap-1 font-mono text-[10px] animate-pulse">
            <ArrowsClockwiseIcon className="size-3 animate-spin" />
            <span>running</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground border-border gap-1 font-mono text-[10px]">
            <StopIcon className="size-3" weight="fill" />
            <span>cancelled</span>
          </Badge>
        );
      case "failed":
      default:
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 font-mono text-[10px]">
            <XCircleIcon className="size-3" weight="fill" />
            <span>failed</span>
          </Badge>
        );
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-3"
            render={<Link href={`/projects/${projectId}/workflows/${workflowId}`} />}
          >
            <ArrowLeftIcon className="size-4" />
            <span>Back to Canvas</span>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workflow?.name ? `${workflow.name} — Runs` : "Workflow Runs"}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {total || runs.length} total
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Complete execution history, step latency, token metrics, and billing traces.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          render={<Link href={`/projects/${projectId}/workflows/${workflowId}`} />}
        >
          <TreeStructureIcon className="size-4 text-primary" weight="bold" />
          <span>Open Canvas</span>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status:</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pl-4 border-l border-border">
            <Switch
              id="include-dry-runs"
              checked={includeDryRuns}
              onCheckedChange={setIncludeDryRuns}
            />
            <Label htmlFor="include-dry-runs" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
              <span>Include Dry Runs</span>
            </Label>
          </div>
        </div>

        <Button size="sm" variant="ghost" onClick={loadData} className="gap-1 text-xs">
          <ArrowsClockwiseIcon className="size-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl space-y-2">
          <ClockCounterClockwiseIcon className="size-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-medium text-foreground">No runs found</h3>
          <p className="text-xs text-muted-foreground">
            Execute a test run from the canvas editor to populate this list.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-24">Version</TableHead>
                <TableHead className="w-44">Started</TableHead>
                <TableHead className="w-28">Duration</TableHead>
                <TableHead className="w-28">Tokens</TableHead>
                <TableHead className="w-28">Credits</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const duration =
                  run.startedAt && run.endedAt
                    ? `${Math.round(
                        (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                      )}s`
                    : "—";

                return (
                  <TableRow
                    key={run._id}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell>{renderStatusBadge(run.status)}</TableCell>
                    <TableCell>
                      {run.isDryRun ? (
                        <Badge variant="secondary" className="text-[10px] font-mono gap-1 text-emerald-600 bg-emerald-500/10">
                          <ShieldCheckIcon className="size-2.5" />
                          <span>Dry Run</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Live
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.workflowVersion > 0 ? `v${run.workflowVersion}` : "Draft"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{duration}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {run.usage?.totalTokens?.toLocaleString() || "0"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {run.isDryRun ? "0 (Exempt)" : run.usage?.creditsDeducted ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        render={
                          <Link
                            href={`/projects/${projectId}/workflows/${workflowId}/runs/${run._id}`}
                          />
                        }
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
