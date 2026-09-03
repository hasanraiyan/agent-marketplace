"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ChevronDown, Inbox, Loader2, Send } from "lucide-react";
import { motion } from "motion/react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function relative(date) {
  if (!date) return null;
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return null;
  }
}

function OpenRequest({ item, onRespond, busy }) {
  const [value, setValue] = useState("");
  const due = relative(item.dueBy);
  const overdue = item.dueBy && new Date(item.dueBy) < new Date();

  const submit = async () => {
    const text = value.trim();
    if (!text) return;
    const ok = await onRespond(item._id, text);
    if (ok) setValue("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4"
    >
      <p className="text-[13px] leading-relaxed font-semibold text-zinc-900">
        {item.ask}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-zinc-400">
        {item.createdAt && <span>Asked {relative(item.createdAt)}</span>}
        {due && (
          <span className={cn(overdue && "font-bold text-red-500")}>
            Due {due}
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer…"
        disabled={busy}
        rows={3}
        className="mt-3 min-h-20 rounded-xl border-zinc-200 bg-white text-[13px] focus-visible:border-[#1E60FF] focus-visible:ring-[#1E60FF]/15"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] font-medium text-zinc-400">
          ⌘ + Enter to send
        </span>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={submit}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#1E60FF] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Send className="size-3" />
          )}
          Send
        </button>
      </div>
    </motion.div>
  );
}

/**
 * "Needed from you": open requests the lead employee has raised, each with
 * an inline reply box. Answered items collapse below.
 */
export function InboxList({ items = [], onRespond, respondingId = null }) {
  const [showAnswered, setShowAnswered] = useState(false);
  const open = items.filter((i) => i.status !== "done");
  const answered = items.filter((i) => i.status === "done");

  return (
    <div className="flex flex-col gap-3">
      {open.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="text-[13px] font-semibold text-zinc-800">
            Nothing needed from you
          </p>
          <p className="mt-0.5 max-w-[220px] text-[11px] font-medium text-zinc-400">
            When the team needs an answer or a file, it lands here.
          </p>
        </div>
      ) : (
        open.map((item) => (
          <OpenRequest
            key={item._id}
            item={item}
            onRespond={onRespond}
            busy={respondingId === item._id}
          />
        ))
      )}

      {answered.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAnswered((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl px-1 py-1.5 text-[11px] font-bold tracking-wide text-zinc-400 uppercase transition-colors hover:text-zinc-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <Inbox className="size-3.5" />
              Answered · {answered.length}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showAnswered && "rotate-180",
              )}
            />
          </button>
          {showAnswered && (
            <div className="mt-1 flex flex-col gap-2">
              {answered.map((item) => (
                <div
                  key={item._id}
                  className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3.5"
                >
                  <p className="text-[12px] font-semibold text-zinc-600">
                    {item.ask}
                  </p>
                  {item.response && (
                    <p className="mt-1.5 rounded-xl bg-white px-3 py-2 text-[12px] leading-relaxed text-zinc-700">
                      {item.response}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
