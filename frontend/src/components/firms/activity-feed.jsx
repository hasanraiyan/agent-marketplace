"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCheck,
  Flag,
  MessageCircleQuestion,
  Package,
  Play,
  StickyNote,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const TYPE_META = {
  started: { icon: Play, className: "bg-[#1E60FF]/10 text-[#1E60FF]" },
  deliverable: { icon: Package, className: "bg-violet-50 text-violet-600" },
  request: {
    icon: MessageCircleQuestion,
    className: "bg-amber-50 text-amber-600",
  },
  note: { icon: StickyNote, className: "bg-zinc-100 text-zinc-500" },
  accepted: { icon: CheckCheck, className: "bg-emerald-50 text-emerald-600" },
  done: { icon: Flag, className: "bg-emerald-500 text-white" },
};

const BY_LABEL = { agent: "Team", client: "You", owner: "Firm owner" };

/**
 * Chronological (newest first) log of what happened on the project.
 */
export function ActivityFeed({ activity = [] }) {
  const entries = [...activity].sort(
    (a, b) => new Date(b.at || 0) - new Date(a.at || 0),
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center">
        <p className="text-[13px] font-semibold text-zinc-800">No activity yet</p>
        <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
          Kick off the project to get things moving.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col">
      {entries.map((entry, i) => {
        const meta = TYPE_META[entry.type] || TYPE_META.note;
        const Icon = meta.icon;
        let when = null;
        try {
          when = entry.at
            ? formatDistanceToNow(new Date(entry.at), { addSuffix: true })
            : null;
        } catch {
          when = null;
        }
        return (
          <motion.li
            key={`${entry.at}-${i}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {i < entries.length - 1 && (
              <span className="absolute top-7 bottom-0 left-[13px] w-px bg-zinc-100" />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                meta.className,
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[12.5px] leading-relaxed text-zinc-800">
                {entry.message}
              </p>
              <p className="mt-0.5 text-[10.5px] font-medium text-zinc-400">
                {BY_LABEL[entry.by] || "Team"}
                {when ? ` · ${when}` : ""}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
