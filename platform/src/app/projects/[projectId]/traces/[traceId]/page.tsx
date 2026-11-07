"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectTrace } from "@/lib/api/projects";
import { TraceView } from "@/components/traces/trace-view";
import { errorMessage, type Span, type TraceRow } from "@/components/traces/trace-utils";

export default function TraceDetailPage() {
  const { projectId, traceId } = useParams<{ projectId: string; traceId: string }>();
  const [trace, setTrace] = React.useState<TraceRow | null>(null);
  const [spans, setSpans] = React.useState<Span[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getProjectTrace(projectId, traceId)
        .then((res) => {
          if (cancelled) return;
          const data = res.data?.data;
          setTrace(data?.trace ?? null);
          setSpans(data?.spans ?? []);
          // Steps are written as a run goes — poll while it's still going,
          // and while a voice call's recording is still being prepared.
          const audioStatus = data?.trace?.audio?.status;
          if (
            data?.trace?.status === "running" ||
            audioStatus === "recording" ||
            audioStatus === "processing"
          ) {
            timer = setTimeout(load, 3000);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err, "Failed to load trace."));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, traceId]);

  const backHref = `/projects/${projectId}/traces`;

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (error || !trace) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6">
        <div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={backHref} />}>
            <ArrowLeftIcon />
            Traces
          </Button>
        </div>
        <p className="text-xs text-destructive">{error ?? "Trace not found."}</p>
      </div>
    );
  }

  return <TraceView trace={trace} spans={spans} backHref={backHref} projectId={projectId} />;
}
