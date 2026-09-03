"use client";

import { Check, FileText, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

/**
 * Scope of work: every deliverable in the SOW with its current status.
 * "Accept" is the client's signature on a delivered item.
 */
export function DeliverableList({
  deliverables = [],
  progress = 0,
  onOpenFile,
  onAccept,
  acceptingIndex = null,
}) {
  const accepted = deliverables.filter((d) => d.status === "accepted").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
              Progress
            </p>
            <p className="font-display mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {Math.round(progress)}%
            </p>
          </div>
          <p className="text-[11px] font-semibold text-zinc-500">
            {accepted}/{deliverables.length} accepted
          </p>
        </div>
        <Progress
          value={progress}
          className="mt-3 h-1.5 bg-zinc-200/70 [&_[data-slot=progress-indicator]]:bg-[#1E60FF]"
        />
      </div>

      {deliverables.length === 0 ? (
        <p className="px-1 text-[12px] font-medium text-zinc-400">
          No deliverables defined for this project.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {deliverables.map((d, index) => {
            const done = d.status === "accepted";
            const canAccept = d.status === "delivered" && onAccept;
            const accepting = acceptingIndex === index;
            return (
              <motion.li
                key={`${index}-${d.name}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className={cn(
                  "rounded-2xl border p-3.5 transition-colors",
                  done
                    ? "border-emerald-100 bg-emerald-50/40"
                    : "border-zinc-100 bg-white",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-200 bg-white text-zinc-500",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-[13px] font-semibold text-zinc-900",
                          done && "text-zinc-600 line-through decoration-zinc-300",
                        )}
                      >
                        {d.name}
                      </p>
                      <StatusBadge
                        kind="deliverable"
                        status={d.status}
                        size="sm"
                      />
                    </div>
                    {d.acceptanceCriteria && (
                      <p className="mt-1 text-[11px] leading-relaxed font-medium text-zinc-400">
                        Done when: {d.acceptanceCriteria}
                      </p>
                    )}
                    {d.note && (
                      <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-[12px] leading-relaxed text-zinc-600">
                        {d.note}
                      </p>
                    )}
                    {(d.artifactPath || canAccept) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {d.artifactPath && (
                          <button
                            type="button"
                            onClick={() => onOpenFile?.(d.artifactPath)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:border-[#1E60FF]/30 hover:text-[#1E60FF]"
                          >
                            <FileText className="size-3" />
                            Open
                            <span className="max-w-[140px] truncate font-mono text-[10px] text-zinc-400">
                              {d.artifactPath.split("/").pop()}
                            </span>
                          </button>
                        )}
                        {canAccept && (
                          <button
                            type="button"
                            disabled={accepting}
                            onClick={() => onAccept(index)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#1E60FF] px-3 py-1 text-[11px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98 disabled:opacity-60"
                          >
                            {accepting ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Accept
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
