"use client";

import Link from "next/link";
import { ArrowRightIcon, BotIcon, Building2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";
import { useFirm } from "@/components/studio/firm-context";

export const FIRM_CATEGORIES = [
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health-fitness", label: "Health & Fitness" },
  { value: "mind-behavior", label: "Mind & Behavior" },
  { value: "technology", label: "Technology" },
  { value: "life-relationships", label: "Life & Relationships" },
  { value: "careers", label: "Careers" },
  { value: "other", label: "Other" },
];

export const categoryLabel = (value) =>
  FIRM_CATEGORIES.find((c) => c.value === value)?.label || "Uncategorized";

/** Rounded card with an optional header row. The building block of the office. */
export function SectionCard({ title, description, action, className, children }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-slate-150/70 bg-white p-5 dark:border-slate-850/60 dark:bg-slate-950/40",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({ label, value, icon: Icon, hint, loading }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-150/70 bg-white p-5 dark:border-slate-850/60 dark:bg-slate-950/40">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12 rounded-md" />
      ) : (
        <div className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
          {value}
        </div>
      )}
      {hint && !loading ? (
        <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const PILL_STYLES = {
  draft:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  published:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  active: "bg-[#1E60FF]/10 text-[#1E60FF] dark:text-blue-300",
  blocked:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  in_progress: "bg-[#1E60FF]/10 text-[#1E60FF] dark:text-blue-300",
  delivered:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  accepted:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  open: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

const PILL_LABELS = { in_progress: "In progress" };

export function StatusPill({ status, className }) {
  const key = status || "draft";
  const label =
    PILL_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-bold tracking-wide whitespace-nowrap",
        PILL_STYLES[key] || PILL_STYLES.draft,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AgentAvatar({ agent, className }) {
  const src = agent?.avatarUrl || agent?.avatar;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("size-9 shrink-0 rounded-xl object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600",
        className,
      )}
    >
      <BotIcon className="size-4.5" />
    </div>
  );
}

export function FirmEmpty({ icon: Icon, title, description, action }) {
  return (
    <Empty className="rounded-2xl border border-slate-150/70 bg-slate-50/50 px-6 py-16 dark:border-slate-850/60 dark:bg-slate-950/20">
      <EmptyHeader>
        <EmptyMedia className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
          {Icon ? <Icon className="size-7" /> : null}
        </EmptyMedia>
        <EmptyTitle className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
          {title}
        </EmptyTitle>
        <EmptyDescription className="font-medium text-slate-500 dark:text-slate-400">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function QuickLink({ href, title, hint, icon: Icon }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-150/70 bg-white p-4 transition-all hover:border-slate-250 dark:border-slate-850/60 dark:bg-slate-950/40 dark:hover:border-slate-700"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-650 dark:bg-slate-900 dark:text-slate-350">
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <div className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-slate-350 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}

/**
 * Gate for sub-pages: shows a skeleton while the firm loads and a pointer to
 * the overview when the creator hasn't built one yet.
 */
export function RequireFirm({ children, skeleton }) {
  const { loading, notFound } = useFirm();
  if (loading) {
    return (
      skeleton || (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )
    );
  }
  if (notFound) {
    return (
      <FirmEmpty
        icon={Building2Icon}
        title="No firm yet"
        description="Set up your firm first — it takes a name and a tagline to get started."
        action={
          <Link href={studioRoutes.firm}>
            <Button className="rounded-full px-6 font-bold">
              Build your firm
            </Button>
          </Link>
        }
      />
    );
  }
  return children;
}

export function formatPrice(price) {
  if (!price || price.amount === undefined || price.amount === null) return "Free";
  const currency = price.currency || "USD";
  let amount;
  try {
    amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price.amount);
  } catch {
    amount = `${price.amount} ${currency}`;
  }
  return price.period === "monthly" ? `${amount}/mo` : amount;
}
