"use client";

import * as React from "react";
import {
  BrainIcon,
  CaretDownIcon,
  CaretRightIcon,
  EyeIcon,
  GearSixIcon,
  ImageIcon,
  RobotIcon,
  UserIcon,
  WrenchIcon,
  XIcon,
} from "@phosphor-icons/react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { CopyButton } from "@/components/chat/copy-button";
import { JsonTreeView } from "@/components/chat/tool-cards/json-tree-view";
import { Spinner } from "@/components/ui/spinner";
import { getProjectTraceFile } from "@/lib/api/projects";
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

export interface TraceImagePart {
  type: string;
  fileId?: string;
  personaFileId?: string;
  name?: string;
  mimeType?: string;
  url?: string;
}

export function extractImageParts(content: unknown): TraceImagePart[] {
  if (!content) return [];
  const parts: unknown[] = Array.isArray(content) ? content : [content];
  const images: TraceImagePart[] = [];

  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    const item = p as Record<string, unknown>;

    const isImage =
      item.type === "image" ||
      item.type === "image_url" ||
      (typeof item.mimeType === "string" && item.mimeType.startsWith("image/")) ||
      (typeof item.fileId === "string" && item.type === "image") ||
      typeof item.personaFileId === "string";

    if (isImage) {
      const fileId = (item.fileId || item.personaFileId || item.id) as string | undefined;
      const url =
        (typeof item.url === "string" && item.url) ||
        (typeof (item.image_url as Record<string, unknown>)?.url === "string" &&
          ((item.image_url as Record<string, unknown>).url as string)) ||
        (typeof item.image_url === "string" && item.image_url) ||
        (typeof (item.source as Record<string, unknown>)?.value === "string" &&
          ((item.source as Record<string, unknown>).value as string)) ||
        (typeof (item.source as Record<string, unknown>)?.url === "string" &&
          ((item.source as Record<string, unknown>).url as string)) ||
        undefined;
      const name = (item.name ||
        item.filename ||
        item.originalName ||
        (item.source as Record<string, unknown>)?.name) as string | undefined;
      const mimeType = (item.mimeType ||
        (item.source as Record<string, unknown>)?.mimeType) as string | undefined;

      images.push({
        type: (item.type as string) || "image",
        fileId: typeof fileId === "string" ? fileId : undefined,
        name: typeof name === "string" ? name : undefined,
        mimeType: typeof mimeType === "string" ? mimeType : undefined,
        url: typeof url === "string" ? url : undefined,
      });
    }
  }

  return images;
}

export function TraceImageItem({
  img,
  projectId,
}: {
  img: TraceImagePart;
  projectId?: string;
}) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [openModal, setOpenModal] = React.useState(false);

  const fileId = img.fileId || img.personaFileId;
  const src = img.url || blobUrl;

  React.useEffect(() => {
    if (img.url || !fileId || !projectId) return;
    let cancelled = false;
    setLoading(true);
    getProjectTraceFile(projectId, fileId)
      .then((res) => {
        if (!cancelled && res.data) {
          const u = URL.createObjectURL(res.data);
          setBlobUrl(u);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load image");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [img.url, fileId, projectId]);

  React.useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const label = img.name || (img.mimeType ? `Image (${img.mimeType})` : "Image attachment");

  return (
    <>
      <div className="group relative flex max-w-xs flex-col overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:bg-muted/50">
        {src ? (
          <div
            className="relative cursor-pointer overflow-hidden bg-black/5 dark:bg-black/30"
            onClick={() => setOpenModal(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              className="max-h-48 w-auto max-w-full object-contain transition-transform group-hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow">
                <EyeIcon className="size-3.5" />
                View image
              </span>
            </div>
          </div>
        ) : loading ? (
          <div className="flex h-28 w-44 flex-col items-center justify-center gap-2 bg-muted/20 text-muted-foreground">
            <Spinner className="size-4 text-primary" />
            <span className="text-[11px]">Loading image…</span>
          </div>
        ) : (
          <div className="flex h-20 w-44 flex-col items-center justify-center gap-1.5 bg-muted/20 p-2.5 text-center text-muted-foreground">
            <ImageIcon className="size-5 text-muted-foreground/60" />
            <span className="line-clamp-1 text-xs font-medium text-foreground">{label}</span>
            {error && <span className="text-[10px] text-destructive">{error}</span>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-1.5 text-[11px]">
          <div className="flex min-w-0 items-center gap-1.5">
            <ImageIcon className="size-3.5 shrink-0 text-sky-500" />
            <span className="truncate font-medium text-foreground" title={label}>
              {label}
            </span>
          </div>
          {fileId && (
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground" title={`File ID: ${fileId}`}>
              {fileId.slice(-6)}
            </span>
          )}
        </div>
      </div>

      {openModal && src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-border bg-card p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-foreground">{label}</span>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} className="max-h-[80vh] w-auto max-w-full rounded object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function contentText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((p) => {
        if (typeof p === "string") return p;
        const part = p as { type?: string; text?: string };
        if (part?.type === "text") return part.text ?? "";
        if (part?.type === "image" || part?.type === "image_url") return "";
        return part?.type ? `*[${part.type}]*` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    return text || null;
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
  // The instruction a main agent hands to a subagent (deepagents `task`).
  task: { label: "Task from main agent", icon: RobotIcon, tile: "bg-violet-500" },
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

export function MessageCard({
  msg,
  toolNames,
  projectId,
}: {
  msg: TraceMessage;
  toolNames?: Map<string, string>;
  projectId?: string;
}) {
  const role = ROLE[msg.role ?? ""] ?? { label: msg.role ?? "Message", icon: GearSixIcon, tile: "bg-zinc-500" };
  const text = contentText(msg.content);
  const images = React.useMemo(() => extractImageParts(msg.content), [msg.content]);
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
        <div className="flex flex-col gap-3">
          {text ? <MessageMarkdown content={text} /> : images.length === 0 ? <JsonTreeView data={msg.content} /> : null}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {images.map((img, i) => (
                <TraceImageItem key={img.fileId || img.url || i} img={img} projectId={projectId} />
              ))}
            </div>
          )}
        </div>
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
        ) : msg.content && typeof msg.content === "object" && images.length === 0 ? (
          <JsonTreeView data={msg.content} />
        ) : null}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {images.map((img, i) => (
              <TraceImageItem key={img.fileId || img.url || i} img={img} projectId={projectId} />
            ))}
          </div>
        )}
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
export function PayloadView({
  value,
  argsStyle = false,
  projectId,
}: {
  value: unknown;
  argsStyle?: boolean;
  projectId?: string;
}) {
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
          <MessageCard key={i} msg={m} toolNames={toolNames} projectId={projectId} />
        ))}
      </div>
    );
  }
  if (isTraceMessage(value)) return <MessageCard msg={value} toolNames={toolNames} projectId={projectId} />;

  const directImages = typeof value === "object" && !Array.isArray(value) ? extractImageParts(value) : [];

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
      {directImages.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pb-3">
          {directImages.map((img, i) => (
            <TraceImageItem key={img.fileId || img.url || i} img={img} projectId={projectId} />
          ))}
        </div>
      )}
      {argsStyle ? <KeyValues value={value} /> : <JsonTreeView data={value} />}
    </CardShell>
  );
}
