"use client";

import * as React from "react";
import {
  CheckCircleIcon,
  WarningCircleIcon,
  RobotIcon,
  GlobeIcon,
  PlugsIcon,
  TagIcon,
  SparkleIcon,
  FileTextIcon,
  LinkIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { MessageMarkdown } from "./message-markdown";
import { toolCallStatus } from "./tool-status";
import type { PersonaToolCall } from "@personaai/react";

/**
 * Body content rendered *inside* ToolCallCard, above the raw Input/Result,
 * whenever the assistant runs `manage_agent` with action "create"/"update"
 * — no card chrome of its own,
 * matching how write_todos renders TodoChecklist inside the same card.
 * Presents the create/update as a real form summary (what the tool is doing
 * and, once it returns, a success/error banner with the saved agent id) as a
 * quick read *in addition to* the raw args/result ToolCallCard still shows
 * underneath, same as every other tool call.
 *
 * `summarizeUpsert` derives the header fields (title/subtitle) for ToolCallCard
 * and the body data from one parse, so the collapsed and expanded states agree.
 */

function parseJson(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

/** id-ify a possibly-object providerId ({_id} / {id}) the way agent-form does. */
function idOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as { _id?: unknown; id?: unknown };
    return str(o._id) || str(o.id);
  }
  return "";
}

function skillLabel(s: unknown): string {
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    const o = s as { name?: unknown; title?: unknown; id?: unknown; _id?: unknown };
    return str(o.name) || str(o.title) || str(o.id) || str(o._id);
  }
  return "";
}

/** Shorten an object id for display while keeping it greppable on hover. */
function shortId(id: string, len = 8): string {
  if (id.length <= len) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function humanize(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export interface AgentUpsertSummary {
  isError: boolean;
  isPending: boolean;
  succeeded: boolean;
  isUpdate: boolean;
  title: string;
  subtitle?: string;
  message: string;
  name: string;
  description: string;
  modelName: string;
  providerId: string;
  category: string;
  visibility: string;
  webSearch: boolean;
  showWebSearch: boolean;
  tags: string[];
  skills: string[];
  mcps: string[];
  rcpSources: string[];
  systemPrompt: string;
}

export function summarizeUpsert(toolCall: PersonaToolCall): AgentUpsertSummary {
  const args = parseJson(toolCall.args);
  const result = parseJson(toolCall.result);

  const status = toolCallStatus(toolCall);
  const isPending = status === "running";
  const resultStatus = str(result?.status);
  const isError = status === "error" || resultStatus === "error";
  const succeeded = !isPending && !isError && resultStatus === "success";

  // manage_agent's fields live under `args.data` (not flat on `args` the way
  // the old single-purpose `upsert_agent` had them), and create-vs-update is
  // the explicit `args.action` now, not "does it carry an id".
  const action = str(args?.action);
  const argsData = (args?.data as Record<string, unknown> | undefined) ?? null;
  const resultAgentId =
    idOf(result?.agentId) || idOf((result?.data as Record<string, unknown> | undefined)?.id);

  const isUpdate = action === "update" || (!action && /updated/i.test(str(result?.message)));
  const isCreate = !isUpdate;

  // Prefer the authoritative saved payload once the call completes; while it is
  // running we can only echo back what was asked for.
  const saved = (result?.data as Record<string, unknown> | undefined) ?? null;
  const view: Record<string, unknown> = succeeded && saved ? saved : (argsData ?? {});

  const name = str(view.name) || str(saved?.name);
  const description = str(view.description) || str(saved?.description);
  const modelName = str(view.modelName) || str(saved?.modelName);
  const providerId = idOf(view.providerId) || idOf(saved?.providerId);
  const category = str(view.category) || str(saved?.category);
  const visibility = str(view.visibility) || str(saved?.visibility);
  const webSearch =
    (view.webSearchEnabled as boolean) ?? (saved?.webSearchEnabled as boolean);
  const showWebSearch =
    (view as Record<string, unknown>).webSearchEnabled !== undefined ||
    (saved != null && (saved as Record<string, unknown>).webSearchEnabled !== undefined);
  const tags = Array.isArray(view.tags)
    ? (view.tags as unknown[]).map(skillLabel).filter(Boolean)
    : [];
  const skills = Array.isArray(view.skills)
    ? (view.skills as unknown[]).map(skillLabel).filter(Boolean)
    : [];
  const mcps = Array.isArray(view.mcps)
    ? (view.mcps as unknown[]).map(skillLabel).filter(Boolean)
    : [];
  const rcpSources = Array.isArray(view.rcpSources)
    ? (view.rcpSources as unknown[]).map(skillLabel).filter(Boolean)
    : [];
  const systemPrompt = str(view.systemPrompt) || str(saved?.systemPrompt);

  const message = str(result?.message);

  const title = isError
    ? "Agent not saved"
    : isPending
      // Once the args have streamed in a name, show it directly (e.g. "Paper
      // Craft Pro") rather than the generic "Creating agent" — the human
      // reviewing this HITL card wants to know *which* agent, not just that
      // one is being written. Falls back to the generic phrasing only while
      // the name itself hasn't arrived yet.
      ? name || (isUpdate ? "Updating agent" : "Creating agent")
      : succeeded
        ? isUpdate
          ? "Agent updated"
          : "Agent created"
        : isCreate
          ? "Creating agent"
          : "Updating agent";

  const subtitle = isError
    ? message || "The agent tool reported an error."
    : isPending
      // Same idea for the subtitle: the agent's own description reads as
      // useful context for approve/reject; "Applying configuration…" doesn't.
      ? description || (name ? `Applying configuration for ${name}…` : "Applying configuration…")
      : succeeded
        ? `${name || "Agent"} · ${resultAgentId ? shortId(resultAgentId) : "saved"}`
        : name || undefined;

  return {
    isError,
    isPending,
    succeeded,
    isUpdate,
    title,
    subtitle,
    message,
    name,
    description,
    modelName,
    providerId,
    category,
    visibility,
    webSearch,
    showWebSearch,
    tags,
    skills,
    mcps,
    rcpSources,
    systemPrompt,
  };
}

// One inline "chip": icon + text, used for the model/web-search/provider meta
// strip — reads at a glance instead of a label/value form grid.
function MetaChip({ icon, children, title }: { icon: React.ReactNode; children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={title}>
      {icon}
      {children}
    </span>
  );
}

function AgentUpsertBody({ summary }: { summary: AgentUpsertSummary }) {
  const {
    isError,
    succeeded,
    isUpdate,
    message,
    name,
    description,
    modelName,
    providerId,
    category,
    visibility,
    webSearch,
    showWebSearch,
    tags,
    skills,
    mcps,
    rcpSources,
    systemPrompt,
  } = summary;

  return (
    <>
      {/* No separate pending banner here — the header (spinner icon, name,
          "…") already says this is in progress; a second "Writing agent
          configuration…" line under it was the same information twice. */}
      {isError ? (
        <div className="flex items-start gap-2 rounded-none border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <WarningCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{message || "Failed to save the agent configuration."}</span>
        </div>
      ) : succeeded ? (
        <div className="flex items-center gap-2 rounded-none border border-emerald-500/20 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircleIcon className="size-3.5 shrink-0 text-emerald-500" />
          <span>{message || `Agent ${isUpdate ? "updated" : "created"}.`}</span>
        </div>
      ) : null}

      {name ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            {visibility ? <Badge variant="outline">{humanize(visibility)}</Badge> : null}
            {category ? <Badge variant="secondary">{humanize(category)}</Badge> : null}
          </div>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}

          {/* Model / web search / provider as a scannable icon+text strip
              instead of a label/value form grid — this is metadata to skim,
              not a form to read line by line. */}
          {(modelName || showWebSearch || providerId) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
              {modelName ? <MetaChip icon={<RobotIcon className="size-3.5" />}>{modelName}</MetaChip> : null}
              {showWebSearch ? (
                <MetaChip icon={<GlobeIcon className="size-3.5" />}>
                  Web search {webSearch ? "on" : "off"}
                </MetaChip>
              ) : null}
              {providerId ? (
                <MetaChip icon={<PlugsIcon className="size-3.5" />} title={providerId}>
                  {shortId(providerId, 20)}
                </MetaChip>
              ) : null}
            </div>
          )}

          {(tags.length > 0 || skills.length > 0 || mcps.length > 0 || rcpSources.length > 0) && (
            <div className="flex flex-col gap-1 pt-0.5">
              {tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {skills.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <SparkleIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {skills.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {mcps.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <PlugsIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {mcps.map((m) => (
                    <Badge key={m} variant="outline">
                      {m}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {rcpSources.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {rcpSources.map((r) => (
                    <Badge key={r} variant="outline">
                      {r}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {systemPrompt ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <FileTextIcon className="size-3.5" />
            Instructions
          </div>
          <div className="max-h-40 overflow-y-auto rounded-none border border-border bg-muted/50 px-3 py-2">
            <MessageMarkdown muted content={systemPrompt} />
          </div>
        </div>
      ) : null}
    </>
  );
}

export { AgentUpsertBody };
