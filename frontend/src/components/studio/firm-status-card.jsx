"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2Icon,
  CircleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RocketIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishMyFirm, unpublishMyFirm } from "@/lib/api/firms";
import { personaRoutes, studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { categoryLabel, StatusPill } from "@/components/studio/firm-primitives";

/** Where to send the creator to fix a given publish blocker. */
function reasonHref(reason) {
  const r = reason.toLowerCase();
  if (r.includes("front desk")) return studioRoutes.firmTeam;
  if (r.includes("project") || r.includes("lead employee"))
    return studioRoutes.firmProjects;
  return "#storefront";
}

export function FirmStatusCard() {
  const { firm, setFirm } = useFirm();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState([]);
  const published = firm.status === "published";

  const toggle = async () => {
    setBusy(true);
    try {
      const res = published ? await unpublishMyFirm() : await publishMyFirm();
      setFirm(res.data?.data || firm);
      setMissing([]);
      toast.success(
        published ? "Firm unpublished" : "Your firm is live in the marketplace",
      );
    } catch (err) {
      const details = err.response?.data?.details;
      if (err.response?.status === 400 && Array.isArray(details) && details.length) {
        setMissing(details);
        toast.error("A few things are missing before you can publish");
      } else {
        toast.error(err.response?.data?.message || "Failed to update firm status");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-150/70 bg-white p-5 dark:border-slate-850/60 dark:bg-slate-950/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {firm.avatar ? (
            <img
              src={firm.avatar}
              alt=""
              className="size-14 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Building2Icon className="size-6" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {firm.name}
              </h1>
              <StatusPill status={firm.status} />
            </div>
            <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
              {firm.tagline || "No tagline yet — add one below."}
            </p>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-slate-400 uppercase dark:text-slate-500">
              {categoryLabel(firm.category)} · /{firm.slug}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {published ? (
            <Link href={personaRoutes.firm(firm.slug)} target="_blank">
              <Button variant="outline" size="sm" className="rounded-full font-bold">
                <ExternalLinkIcon />
                View storefront
              </Button>
            </Link>
          ) : null}
          <Button
            size="sm"
            variant={published ? "outline" : "default"}
            disabled={busy}
            onClick={toggle}
            className="rounded-full px-4 font-bold"
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <RocketIcon />}
            {published ? "Unpublish" : "Publish firm"}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {missing.length ? (
          <motion.div
            key="missing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="text-xs font-bold tracking-wide text-amber-900 uppercase dark:text-amber-200">
                Before you publish
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {missing.map((reason) => (
                  <li key={reason}>
                    <Link
                      href={reasonHref(reason)}
                      className="flex items-center gap-2 text-sm font-semibold text-amber-900 hover:underline dark:text-amber-100"
                    >
                      <CircleIcon className="size-3.5 shrink-0 text-amber-500" />
                      {reason}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
