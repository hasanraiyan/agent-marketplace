"use client";

import { useMemo } from "react";
import { FileCode, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseToolArgs } from "../utils";

// Line-level LCS diff. Bounded: falls back to a naive remove-then-add
// rendering when either side is too large for O(n*m) DP to stay fast.
function computeLineDiff(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  if (n * m > 250000) {
    return [
      ...oldLines.map((line) => ({ type: "remove", line })),
      ...newLines.map((line) => ({ type: "add", line })),
    ];
  }

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "context", line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "remove", line: oldLines[i] });
      i++;
    } else {
      rows.push({ type: "add", line: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "remove", line: oldLines[i] });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", line: newLines[j] });
    j++;
  }
  return rows;
}

// Unified diff: red (-) removed lines, green (+) added lines, dimmed context.
export function DiffView({ oldContent = "", newContent = "", fileName, note }) {
  const rows = useMemo(() => {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    return computeLineDiff(oldLines, newLines);
  }, [oldContent, newContent]);

  const added = rows.filter((row) => row.type === "add").length;
  const removed = rows.filter((row) => row.type === "remove").length;

  const fileExt = fileName?.includes(".")
    ? fileName.split(".").pop()?.toUpperCase()
    : "FILE";
  const isCode = [
    "JS",
    "JSX",
    "TS",
    "TSX",
    "JSON",
    "HTML",
    "CSS",
    "PY",
    "SH",
    "GO",
    "RS",
    "MD",
  ].includes(fileExt);
  const FileIcon = isCode ? FileCode : FileText;

  let oldNo = 1;
  let newNo = 1;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-950">
      {fileName ? (
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileIcon className="size-4" />
            </div>
            <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
              {fileName}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-bold tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{added}
            </span>{" "}
            <span className="text-red-500 dark:text-red-400">-{removed}</span>
          </span>
        </div>
      ) : null}

      {note ? (
        <div className="border-b border-slate-100 bg-slate-50/40 px-3.5 py-1.5 text-[10px] font-semibold text-slate-450 dark:border-slate-800/80 dark:bg-slate-900/20 dark:text-slate-500">
          {note}
        </div>
      ) : null}

      <div className="max-h-72 overflow-auto font-mono text-[11.5px] leading-5 scrollbar-thin">
        {rows.map((row, index) => {
          const displayOldNo = row.type !== "add" ? oldNo++ : null;
          const displayNewNo = row.type !== "remove" ? newNo++ : null;
          return (
            <div
              key={index}
              className={cn(
                "flex",
                row.type === "add" && "bg-emerald-50 dark:bg-emerald-500/10",
                row.type === "remove" && "bg-red-50 dark:bg-red-500/10",
              )}
            >
              <span className="w-8 shrink-0 select-none border-r border-slate-100 px-1.5 text-right text-slate-350 dark:border-slate-800/80 dark:text-slate-600">
                {displayOldNo ?? ""}
              </span>
              <span className="w-8 shrink-0 select-none border-r border-slate-100 px-1.5 text-right text-slate-350 dark:border-slate-800/80 dark:text-slate-600">
                {displayNewNo ?? ""}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none text-center font-bold",
                  row.type === "add" &&
                    "text-emerald-600 dark:text-emerald-400",
                  row.type === "remove" && "text-red-500 dark:text-red-400",
                )}
              >
                {row.type === "add" ? "+" : row.type === "remove" ? "-" : ""}
              </span>
              <span className="flex-1 whitespace-pre px-1.5 text-slate-700 dark:text-slate-300">
                {row.line || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Line counts for the card row's "+19 -6" diffstat. Returns null when the
// args aren't parseable (yet) — the caller falls back to the generic panel
// instead of rendering an empty diff.
export function computeFileDiffStats(tool) {
  const args = parseToolArgs(tool.argumentsText) || {};
  const name = (tool.name || "").toLowerCase();

  if (name === "write_file") {
    if (typeof args.content !== "string") return null;
    return { added: args.content.split("\n").length, removed: 0 };
  }

  if (name === "edit_file") {
    if (
      typeof args.old_string !== "string" &&
      typeof args.new_string !== "string"
    ) {
      return null;
    }
    const rows = computeLineDiff(
      String(args.old_string ?? "").split("\n"),
      String(args.new_string ?? "").split("\n"),
    );
    return {
      added: rows.filter((row) => row.type === "add").length,
      removed: rows.filter((row) => row.type === "remove").length,
    };
  }

  return null;
}

// Reads a write_file / edit_file tool's arguments and renders the DiffView.
// write_file has no prior content available client-side, so the entire body
// renders as additions; edit_file diffs old_string against new_string.
export function FileDiffCard({ tool }) {
  const args = parseToolArgs(tool.argumentsText) || {};
  const nameLower = (tool.name || "").toLowerCase();
  const filePath = args.file_path || args.filePath || args.path || "";

  if (nameLower === "edit_file") {
    const oldContent =
      typeof args.old_string === "string" ? args.old_string : "";
    const newContent =
      typeof args.new_string === "string" ? args.new_string : "";
    return (
      <DiffView
        fileName={filePath}
        oldContent={oldContent}
        newContent={newContent}
        note={args.replace_all ? "Replacing all occurrences" : undefined}
      />
    );
  }

  const content = typeof args.content === "string" ? args.content : "";
  return <DiffView fileName={filePath} oldContent="" newContent={content} />;
}
