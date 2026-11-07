"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjectTraceStats } from "@/lib/api/projects";
import { KindIcon, errorMessage, formatDuration, formatTokens } from "@/components/traces/trace-utils";

interface DayRow {
  date: string;
  runs: number;
  errors: number;
  totalTokens: number;
  avgDurationMs: number | null;
}

interface Stats {
  days: number;
  totals: {
    runs: number;
    errors: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    llmCalls: number;
    toolCalls: number;
    avgDurationMs: number | null;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
  };
  byDay: DayRow[];
  byAgent: { agentId: string; agentName?: string | null; runs: number; errors: number; totalTokens: number; avgDurationMs: number | null }[];
  tools: { name: string; kind: string; calls: number; errors: number; avgDurationMs: number | null }[];
}

const runsConfig = {
  succeeded: { label: "Succeeded", color: "var(--chart-2)" },
  errors: { label: "Errors", color: "var(--destructive)" },
} satisfies ChartConfig;

const tokensConfig = {
  totalTokens: { label: "Tokens", color: "var(--chart-3)" },
} satisfies ChartConfig;

const latencyConfig = {
  avgDurationMs: { label: "Avg duration", color: "var(--chart-4)" },
} satisfies ChartConfig;

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-border bg-card px-3 py-2.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border border-border p-3">
      <span className="text-xs font-medium">{title}</span>
      {children}
    </div>
  );
}

export function TraceUsage({ projectId, agentId }: { projectId: string; agentId?: string }) {
  const [days, setDays] = React.useState(7);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [result, setResult] = React.useState<{ key: string; error: string | null } | null>(null);
  const requestKey = `${projectId}|${agentId ?? ""}|${days}`;
  const loading = result?.key !== requestKey;
  const error = loading ? null : result?.error ?? null;

  React.useEffect(() => {
    let cancelled = false;
    getProjectTraceStats(projectId, { days, agentId: agentId || undefined })
      .then((res) => {
        if (cancelled) return;
        setStats(res.data?.data ?? null);
        setResult({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: requestKey, error: errorMessage(err, "Failed to load usage.") });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, days, requestKey]);

  const runsData = React.useMemo(
    () =>
      (stats?.byDay ?? []).map((d) => ({
        date: d.date,
        succeeded: Math.max(0, d.runs - d.errors),
        errors: d.errors,
      })),
    [stats]
  );

  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        {agentId ? "Selected agent" : "All agents"} · last {days} days
      </span>
      <NativeSelect
        size="sm"
        value={String(days)}
        onChange={(e) => setDays(Number(e.target.value))}
        aria-label="Time range"
      >
        <NativeSelectOption value="1">24 hours</NativeSelectOption>
        <NativeSelectOption value="7">7 days</NativeSelectOption>
        <NativeSelectOption value="30">30 days</NativeSelectOption>
        <NativeSelectOption value="90">90 days</NativeSelectOption>
      </NativeSelect>
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }
  if (!stats) return null;

  const t = stats.totals;
  const errorRate = t.runs ? `${((t.errors / t.runs) * 100).toFixed(1)}% error rate` : undefined;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Runs" value={t.runs.toLocaleString()} hint={errorRate} />
        <Tile
          label="Tokens"
          value={formatTokens(t.totalTokens)}
          hint={`${formatTokens(t.inputTokens)} in · ${formatTokens(t.outputTokens)} out`}
        />
        <Tile
          label="Latency p50 / p95"
          value={`${formatDuration(t.p50DurationMs)} / ${formatDuration(t.p95DurationMs)}`}
          hint={`avg ${formatDuration(t.avgDurationMs)}`}
        />
        <Tile
          label="Calls"
          value={`${t.llmCalls.toLocaleString()} LLM`}
          hint={`${t.toolCalls.toLocaleString()} tool calls`}
        />
      </div>

      {t.runs === 0 ? (
        <p className="border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          No runs in this period.
        </p>
      ) : (
        <>
          <ChartBlock title="Runs per day">
            <ChartContainer config={runsConfig} className="h-52 w-full">
              <BarChart data={runsData} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={shortDate} minTickGap={16} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={11} />
                <ChartTooltip cursor={{ fillOpacity: 0.15 }} content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="succeeded" stackId="runs" fill="var(--color-succeeded)" stroke="var(--background)" strokeWidth={1} maxBarSize={28} />
                <Bar dataKey="errors" stackId="runs" fill="var(--color-errors)" stroke="var(--background)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </ChartBlock>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartBlock title="Tokens per day">
              <ChartContainer config={tokensConfig} className="h-44 w-full">
                <BarChart data={stats.byDay} margin={{ left: 0, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.4} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={shortDate} minTickGap={16} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} tickFormatter={(v) => formatTokens(Number(v))} />
                  <ChartTooltip
                    cursor={{ fillOpacity: 0.15 }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(value) => `${Number(value).toLocaleString()} tokens`}
                      />
                    }
                  />
                  <Bar dataKey="totalTokens" fill="var(--color-totalTokens)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </ChartBlock>
            <ChartBlock title="Average run duration">
              <ChartContainer config={latencyConfig} className="h-44 w-full">
                <LineChart data={stats.byDay} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.4} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={shortDate} minTickGap={16} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => formatDuration(Number(v))} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(value) => formatDuration(Number(value))}
                      />
                    }
                  />
                  <Line
                    dataKey="avgDurationMs"
                    type="monotone"
                    stroke="var(--color-avgDurationMs)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </ChartBlock>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartBlock title="By agent">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byAgent.map((a) => (
                    <TableRow key={a.agentId}>
                      <TableCell className="max-w-[160px] truncate text-xs">{a.agentName || a.agentId}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{a.runs}</TableCell>
                      <TableCell className={`text-right font-mono text-xs ${a.errors ? "text-destructive" : "text-muted-foreground"}`}>
                        {a.errors}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatTokens(a.totalTokens)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatDuration(a.avgDurationMs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ChartBlock>
            <ChartBlock title="Most-used tools">
              {stats.tools.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No tool calls in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.tools.map((tool) => (
                      <TableRow key={tool.name}>
                        <TableCell className="max-w-[200px] text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <KindIcon kind={tool.kind} />
                            <span className="truncate font-mono">{tool.name}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{tool.calls}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${tool.errors ? "text-destructive" : "text-muted-foreground"}`}>
                          {tool.errors}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatDuration(tool.avgDurationMs)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ChartBlock>
          </div>
        </>
      )}
    </div>
  );
}
