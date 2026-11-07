"use client";

import * as React from "react";
import { BrainIcon, CaretDownIcon, CaretRightIcon, GearSixIcon, UserIcon, WrenchIcon } from "@phosphor-icons/react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { CopyButton } from "@/components/chat/copy-button";
import { JsonTreeView } from "@/components/chat/tool-cards/json-tree-view";
import { cn } from "@/lib/utils";

/** A trace-serialized LangChain message (see backend traceSerializer.js). */
export interface TraceMessage {
  role?: string;
  content?: unknown;
  name?: string;
  tool_calls?: { id?: string; name?: string; args?: unknown }[];
  tool_call_id?: string;
}

export function isTraceMessage(v: unknown): v is TraceMessage {
  return !!v && typeof v === "object" && !Array.isArray(v) && "role" in v && "content" in v;
}

export function isMessageList(v: unknown): v is TraceMessage[] {
  return Array.isArray(v) && v.length > 0 && v.every(isTraceMessage);
}

function contentText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        const part = p as { type?: string; text?: string };
        if (part?.type === "text") return part.text ?? "";
        return part?.type ? `*[${part.type}]*` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return null;
}

/** Small colored square with a white icon — the LangSmith-style run glyph. */
export function IconTile({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: React.ElementType;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[5px] text-white",
        size === "sm" ? "size-[18px]" : "size-[22px]",
        className
      )}
    >
      <Icon weight="bold" className={size === "sm" ? "size-3" : "size-3.5"} />
    </span>
  );
}

const ROLE: Record<string, { label: string; icon: React.ElementType; tile: string }> = {
  user: { label: "User", icon: UserIcon, tile: "bg-blue-500" },
  assistant: { label: "AI", icon: BrainIcon, tile: "bg-orange-500" },
  system: { label: "System", icon: GearSixIcon, tile: "bg-zinc-500" },
  tool: { label: "Tool", icon: WrenchIcon, tile: "bg-emerald-600" },
};

function KeyValues({ value }: { value: unknown }) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-xs text-muted-foreground">No arguments</span>;
    return (
      <ul className="flex flex-col gap-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex min-w-0 items-start gap-2 text-sm">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <span className="shrink-0 text-muted-foreground">{k}</span>
            {v !== null && typeof v === "object" ? (
              <JsonTreeView data={v} className="min-w-0" />
            ) : (
              <span className="min-w-0 break-words">{String(v)}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return <JsonTreeView data={value} />;
}

function CardShell({
  header,
  copy,
  collapsible = false,
  children,
}: {
  header: React.ReactNode;
  copy?: string | null;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className={cn("flex items-center gap-2 px-3 py-2", collapsible && "bg-muted/40")}>
        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        {copy ? <CopyButton text={copy} /> : null}
      </div>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

export function MessageCard({ msg, toolNames }: { msg: TraceMessage; toolNames?: Map<string, string> }) {
  const role = ROLE[msg.role ?? ""] ?? { label: msg.role ?? "Message", icon: GearSixIcon, tile: "bg-zinc-500" };
  const text = contentText(msg.content);
  const copy = text ?? (msg.content ? JSON.stringify(msg.content, null, 2) : null);

  if (msg.role === "tool") {
    const name = msg.name || (msg.tool_call_id && toolNames?.get(msg.tool_call_id)) || "tool";
    return (
      <CardShell
        collapsible
        copy={copy}
        header={
          <>
            <span className="truncate text-sm font-medium">{name}</span>
            {msg.tool_call_id && (
              <span className="truncate font-mono text-[10px] text-muted-foreground">{msg.tool_call_id}</span>
            )}
          </>
        }
      >
        {text ? <MessageMarkdown content={text} /> : <JsonTreeView data={msg.content} />}
      </CardShell>
    );
  }

  return (
    <CardShell
      copy={copy}
      header={
        <>
          <IconTile icon={role.icon} className={role.tile} size="sm" />
          <span className="text-sm font-medium">{role.label}</span>
          {msg.name && <span className="truncate text-xs text-muted-foreground">{msg.name}</span>}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {text ? (
          <MessageMarkdown content={text} />
        ) : msg.content && typeof msg.content === "object" ? (
          <JsonTreeView data={msg.content} />
        ) : null}
        {msg.tool_calls?.map((tc, i) => (
          <div key={tc.id ?? i} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <IconTile icon={WrenchIcon} className="bg-emerald-600" size="sm" />
              <span className="text-sm font-medium">{tc.name}</span>
            </div>
            <div className="pl-7">
              <KeyValues value={tc.args ?? {}} />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/** Renders any span input/output: message lists as chat cards, else text / args / JSON. */
export function PayloadView({ value, argsStyle = false }: { value: unknown; argsStyle?: boolean }) {
  const toolNames = React.useMemo(() => {
    const map = new Map<string, string>();
    const list = isMessageList(value) ? value : isTraceMessage(value) ? [value] : [];
    for (const m of list) for (const tc of m.tool_calls ?? []) if (tc.id && tc.name) map.set(tc.id, tc.name);
    return map;
  }, [value]);

  if (value === null || value === undefined || value === "") {
    return <p className="text-xs text-muted-foreground">—</p>;
  }
  if (isMessageList(value)) {
    return (
      <div className="flex flex-col gap-2.5">
        {value.map((m, i) => (
          <MessageCard key={i} msg={m} toolNames={toolNames} />
        ))}
      </div>
    );
  }
  if (isTraceMessage(value)) return <MessageCard msg={value} toolNames={toolNames} />;
  if (typeof value === "string") {
    return (
      <CardShell copy={value} header={<span className="text-xs text-muted-foreground">Text</span>}>
        <MessageMarkdown content={value} />
      </CardShell>
    );
  }
  const json = JSON.stringify(value, null, 2);
  return (
    <CardShell copy={json} header={<span className="text-xs text-muted-foreground">{argsStyle ? "Arguments" : "JSON"}</span>}>
      {argsStyle ? <KeyValues value={value} /> : <JsonTreeView data={value} />}
    </CardShell>
  );
}
