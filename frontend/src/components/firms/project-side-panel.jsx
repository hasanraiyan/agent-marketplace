"use client";

import { format } from "date-fns";
import { Activity, Inbox, Info, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliverableList } from "./deliverable-list";
import { InboxList } from "./inbox-list";
import { ActivityFeed } from "./activity-feed";
import { formatDuration, formatPrice } from "./utils";
import { cn } from "@/lib/utils";

export const PANEL_TABS = [
  { value: "scope", label: "Scope", icon: ListChecks },
  { value: "inbox", label: "Needed from you", icon: Inbox },
  { value: "activity", label: "Activity", icon: Activity },
  { value: "details", label: "Details", icon: Info },
];

function fmtDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function humanKey(key) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function DetailsTab({ project }) {
  const sow = project.sow || {};
  const inputs = project.inputs || {};
  const inputEntries = Object.entries(inputs).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
  );
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
          Outcome
        </p>
        <p className="text-[13.5px] leading-relaxed font-medium text-zinc-800">
          {project.outcome || "—"}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Started", fmtDate(project.startedAt)],
          ["Due", fmtDate(project.dueAt)],
          ["Price", formatPrice(sow.price)],
          ["Timeline", formatDuration(sow.durationDays) || "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-100 p-3">
            <dt className="text-[10px] font-bold tracking-wide text-zinc-400 uppercase">
              {label}
            </dt>
            <dd className="mt-0.5 text-[13px] font-semibold text-zinc-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {inputEntries.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
            What you provided
          </p>
          <div className="flex flex-col gap-2">
            {inputEntries.map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-zinc-50 px-3.5 py-2.5">
                <p className="text-[10.5px] font-semibold text-zinc-400">
                  {humanKey(key)}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed break-words whitespace-pre-line text-zinc-800">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {sow.checkpoints?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
            Where the human steps in
          </p>
          <ul className="flex flex-col gap-1.5">
            {sow.checkpoints.map((c) => (
              <li
                key={c}
                className="flex items-start gap-2 text-[12.5px] text-zinc-700"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1E60FF]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The right-hand pane of the project workspace: scope, inbox, activity,
 * details. Controlled tabs so a header button can jump to a tab.
 */
export function ProjectSidePanel({
  project,
  tab,
  onTabChange,
  onOpenFile,
  onAccept,
  acceptingIndex,
  onRespond,
  respondingId,
  className,
}) {
  const openCount = (project.inbox || []).filter(
    (i) => i.status !== "done",
  ).length;
  const deliverables = project.sow?.deliverables || [];

  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className={cn("flex h-full min-h-0 flex-col gap-0 bg-white", className)}
    >
      <TabsList
        variant="line"
        className="h-auto w-full shrink-0 justify-start gap-0 overflow-x-auto border-b border-zinc-100 px-2 no-scrollbar"
      >
        {PANEL_TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.value === "inbox"
              ? openCount
              : t.value === "scope"
                ? deliverables.length
                : 0;
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="h-11 flex-none gap-1.5 px-3 text-[12px] font-semibold text-zinc-500 after:bottom-0 after:h-[2px] after:bg-[#1E60FF] data-active:text-zinc-900"
            >
              <Icon className="size-3.5" />
              {t.label}
              {count > 0 && (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                    t.value === "inbox"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-500",
                  )}
                >
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TabsContent value="scope" className="mt-0">
          <DeliverableList
            deliverables={deliverables}
            progress={project.progress || 0}
            onOpenFile={onOpenFile}
            onAccept={onAccept}
            acceptingIndex={acceptingIndex}
          />
        </TabsContent>
        <TabsContent value="inbox" className="mt-0">
          <InboxList
            items={project.inbox || []}
            onRespond={onRespond}
            respondingId={respondingId}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ActivityFeed activity={project.activity || []} />
        </TabsContent>
        <TabsContent value="details" className="mt-0">
          <DetailsTab project={project} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
