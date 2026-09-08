"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CaretLeftIcon, CaretRightIcon, ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { getProjectAuditLogs } from "@/lib/api/projects";

interface AuditLogEntry {
  _id: string;
  id?: string;
  eventType: string;
  actorContextType: string;
  actorIdentity?: string | null;
  targetResourceId?: string | null;
  timestamp?: string;
}

interface AuditPageData {
  items: AuditLogEntry[];
  pagination: { page: number; pages: number };
}

const PAGE_SIZE = 20;

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

export default function AuditLogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [logs, setLogs] = React.useState<AuditLogEntry[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjectAuditLogs(projectId, { page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        const data: AuditPageData = res.data?.data;
        setLogs(data?.items ?? []);
        setPages(data?.pagination?.pages || 1);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load audit logs."));
          setLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

  return (
    <div className="flex w-full flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 truncate text-base sm:text-sm">
              <ClockCounterClockwiseIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Audit Logs</span>
            </CardTitle>
            <CardDescription className="line-clamp-3 max-w-xl text-[11px] leading-snug sm:line-clamp-none sm:text-xs">
              Project lifecycle — credentials, membership, suspend/restore. Resource CRUD isn&apos;t logged here.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : logs && logs.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead className="hidden md:table-cell">Target</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id || log.id || log.timestamp}>
                        <TableCell>
                          <Badge variant="outline" className="max-w-[140px] truncate">
                            {log.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                          {log.actorContextType}
                          {log.actorIdentity ? ` · ${log.actorIdentity}` : ""}
                        </TableCell>
                        <TableCell className="hidden max-w-[140px] truncate font-mono text-xs text-muted-foreground md:table-cell">
                          {log.targetResourceId || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile stacked cards */}
              <div className="flex flex-col gap-2 sm:hidden">
                {logs.map((log) => (
                  <div
                    key={log._id || log.id || log.timestamp}
                    className="flex flex-col gap-1.5 rounded-none border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="max-w-[160px] truncate text-[11px]">
                        {log.eventType}
                      </Badge>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {log.actorContextType}
                      {log.actorIdentity ? ` · ${log.actorIdentity}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <CaretLeftIcon />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <CaretRightIcon />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty className="border border-dashed border-border py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClockCounterClockwiseIcon />
                </EmptyMedia>
                <EmptyTitle>No audit events yet</EmptyTitle>
                <EmptyDescription>
                  Project lifecycle events will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
