import * as React from "react";

export type ExecutionStatus = "running" | "completed" | "failed" | undefined;

/**
 * Shared card shell for every workflow node — reference: Flowise's
 * NodeCardWrapper (primary-colored border on select) and Langflow's
 * GenericNode (`rounded-xl border shadow-sm hover:shadow-md`, elevation on
 * hover rather than only on select). One definition so all six node types
 * read as the same visual system instead of drifting.
 */
export function nodeShellClass(selected?: boolean, status?: ExecutionStatus): string {
  const border =
    status === "running"
      ? "border-blue-500"
      : status === "completed"
      ? "border-emerald-500"
      : status === "failed"
      ? "border-destructive"
      : selected
      ? "border-primary"
      : "border-border hover:border-foreground/30";
  const ring =
    status === "running" ? "ring-2 ring-blue-500/30" : selected ? "ring-2 ring-primary/20" : "";
  return `relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${border} ${ring}`.trim();
}

/**
 * Explicit status indicator in the node's header band — a small colored
 * dot, rather than relying only on the card's border color (which reads
 * fine up close but is easy to miss at a glance across a busy canvas;
 * both Flowise and n8n pair their border/icon state with a dedicated
 * status affordance for exactly this reason).
 */
export function StatusDot({ status }: { status?: ExecutionStatus }) {
  if (!status) return null;
  const cls =
    status === "running"
      ? "bg-blue-500 animate-pulse"
      : status === "completed"
      ? "bg-emerald-500"
      : "bg-destructive";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} aria-label={`Status: ${status}`} title={status} />;
}

/** Header band shared by every node — icon badge, label, status dot, divider before the body. */
export function NodeHeader({
  icon,
  iconClassName,
  label,
  status,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  status?: ExecutionStatus;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/40 px-3.5 py-2.5">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        {icon}
      </div>
      <span className="flex-1 truncate text-xs font-semibold text-foreground">{label}</span>
      <StatusDot status={status} />
    </div>
  );
}
