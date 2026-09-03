import { cn } from "@/lib/utils";
import { PROJECT_STATUS, DELIVERABLE_STATUS } from "./utils";

/**
 * Small pill for ClientProject status ("project") or SOW deliverable status
 * ("deliverable"). Colours are distinct per state so a list scans quickly.
 */
export function StatusBadge({ status, kind = "project", className, size }) {
  const table = kind === "deliverable" ? DELIVERABLE_STATUS : PROJECT_STATUS;
  const meta = table[status] || {
    label: status || "Unknown",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    dot: "bg-zinc-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        meta.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
