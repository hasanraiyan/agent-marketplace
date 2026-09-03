"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  FileTextIcon,
  FlagIcon,
  InboxIcon,
  MessageSquareIcon,
  PlayIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { StatusPill, formatPrice } from "@/components/studio/firm-primitives";

const ACTIVITY_ICON = {
  started: PlayIcon,
  deliverable: FileTextIcon,
  request: InboxIcon,
  note: MessageSquareIcon,
  accepted: CheckCircle2Icon,
  done: FlagIcon,
};

const fmtDate = (d) => (d ? format(new Date(d), "MMM d, yyyy") : "—");
const ago = (d) =>
  d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "";

function Section({ title, count, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
        {title}
        {count !== undefined ? (
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-150/70 p-3 dark:border-slate-850/60">
      <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

export function ClientProjectSheet({ project, onOpenChange }) {
  const open = Boolean(project);
  const p = project || {};
  const deliverables = p.sow?.deliverables || [];
  const inbox = [...(p.inbox || [])].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "open" ? -1 : 1,
  );
  const activity = [...(p.activity || [])].sort(
    (a, b) => new Date(b.at || 0) - new Date(a.at || 0),
  );
  const inputs = Object.entries(p.inputs || {});
  const client = p.clientId || {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-slate-150/70 pr-12 dark:border-slate-850/60">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-display text-lg font-extrabold tracking-tight">
              {p.title}
            </SheetTitle>
            <StatusPill status={p.status} />
          </div>
          <SheetDescription className="font-medium">
            {client.name || "Client"}
            {client.email ? ` · ${client.email}` : ""}
            {p.leadAgentId?.name ? ` · led by ${p.leadAgentId.name}` : ""}
          </SheetDescription>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={p.progress || 0} className="h-1.5" />
            <span className="text-xs font-bold text-slate-600 tabular-nums dark:text-slate-300">
              {Math.round(p.progress || 0)}%
            </span>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          <Section title="Outcome">
            <p className="text-sm leading-relaxed font-semibold text-slate-900 dark:text-slate-100">
              {p.outcome || "—"}
            </p>
          </Section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Started" value={fmtDate(p.startedAt)} />
            <Fact label="Due" value={fmtDate(p.dueAt)} />
            <Fact label="Completed" value={fmtDate(p.completedAt)} />
            <Fact label="Price" value={formatPrice(p.sow?.price)} />
          </div>

          <Section title="Deliverables" count={deliverables.length}>
            {deliverables.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">None recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deliverables.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-slate-150/70 p-3 dark:border-slate-850/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {d.name}
                      </span>
                      <StatusPill status={d.status || "pending"} />
                    </div>
                    {d.acceptanceCriteria ? (
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {d.acceptanceCriteria}
                      </p>
                    ) : null}
                    {d.note ? (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {d.note}
                      </p>
                    ) : null}
                    {d.artifactPath ? (
                      <code className="mt-2 block truncate text-[11px] font-semibold text-[#1E60FF]">
                        {d.artifactPath}
                      </code>
                    ) : null}
                    {d.updatedAt ? (
                      <div className="mt-1.5 text-[10px] font-semibold text-slate-400">
                        Updated {ago(d.updatedAt)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Needed from client" count={inbox.length}>
            {inbox.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">Nothing asked yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {inbox.map((item) => (
                  <li
                    key={item._id}
                    className={cn(
                      "rounded-xl border p-3",
                      item.status === "open"
                        ? "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
                        : "border-slate-150/70 dark:border-slate-850/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.ask}
                      </span>
                      <StatusPill status={item.status === "open" ? "open" : "done"} />
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">
                      Asked {ago(item.createdAt)}
                      {item.dueBy ? ` · due ${fmtDate(item.dueBy)}` : ""}
                    </div>
                    {item.response ? (
                      <p className="mt-2 rounded-lg bg-white p-2 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {item.response}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Inputs provided" count={inputs.length}>
            {inputs.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">No inputs collected.</p>
            ) : (
              <dl className="grid grid-cols-1 gap-2">
                {inputs.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-150/70 p-3 dark:border-slate-850/60"
                  >
                    <dt className="font-mono text-[10px] font-bold text-slate-400">{key}</dt>
                    <dd className="mt-0.5 text-xs font-medium break-words whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title="Activity" count={activity.length}>
            {activity.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">Quiet so far.</p>
            ) : (
              <ol className="relative flex flex-col gap-3 border-l border-slate-150/70 pl-5 dark:border-slate-850/60">
                {activity.map((a, i) => {
                  const Icon = ACTIVITY_ICON[a.type] || CircleDotIcon;
                  return (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] flex size-4 items-center justify-center rounded-full bg-white text-slate-400 ring-2 ring-slate-150/70 dark:bg-slate-950 dark:ring-slate-850/60">
                        <Icon className="size-3" />
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {a.message}
                      </p>
                      <div className="text-[10px] font-semibold text-slate-400 capitalize">
                        {a.by || "agent"} · {ago(a.at)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
