"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  PersonaChatView: () => PersonaChatView,
  PersonaComposer: () => PersonaComposer,
  PersonaFilesDrawer: () => PersonaFilesDrawer,
  PersonaInterruptCard: () => PersonaInterruptCard,
  PersonaMessageFeed: () => PersonaMessageFeed,
  PersonaSidebar: () => PersonaSidebar,
  PersonaToolTrace: () => PersonaToolTrace,
  VERSION: () => VERSION,
  cn: () => cn
});
module.exports = __toCommonJS(index_exports);

// src/utils/cn.ts
var import_clsx = require("clsx");
var import_tailwind_merge = require("tailwind-merge");
function cn(...inputs) {
  return (0, import_tailwind_merge.twMerge)((0, import_clsx.clsx)(inputs));
}

// src/components/PersonaChatView.tsx
var import_react7 = require("react");
var import_react8 = require("@personaai/react");

// src/components/PersonaSidebar.tsx
var import_react = require("react");
var import_lucide_react = require("lucide-react");
var import_jsx_runtime = require("react/jsx-runtime");
function groupThreadsByDate(threads) {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 864e5;
  const sevenDaysAgo = today - 7 * 864e5;
  const groups = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: []
  };
  for (const thread of threads) {
    const time = new Date(thread.updatedAt || thread.createdAt).getTime();
    if (time >= today) {
      groups.today.push(thread);
    } else if (time >= yesterday) {
      groups.yesterday.push(thread);
    } else if (time >= sevenDaysAgo) {
      groups.last7Days.push(thread);
    } else {
      groups.older.push(thread);
    }
  }
  return groups;
}
function PersonaSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onClose,
  className
}) {
  const [search, setSearch] = (0, import_react.useState)("");
  const [renamingId, setRenamingId] = (0, import_react.useState)(null);
  const [renameValue, setRenameValue] = (0, import_react.useState)("");
  const filteredThreads = (0, import_react.useMemo)(() => {
    if (!search.trim()) return threads;
    return threads.filter(
      (t) => (t.title || "New Chat").toLowerCase().includes(search.toLowerCase())
    );
  }, [threads, search]);
  const groups = (0, import_react.useMemo)(() => groupThreadsByDate(filteredThreads), [filteredThreads]);
  function startRename(t) {
    setRenamingId(t._id);
    setRenameValue(t.title || "New Chat");
  }
  function commitRename(threadId) {
    if (renameValue.trim()) {
      onRenameThread?.(threadId, renameValue.trim());
    }
    setRenamingId(null);
  }
  function renderGroup(title, items) {
    if (items.length === 0) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mb-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1.5 space-y-0.5", children: items.map((thread) => {
        const isActive = thread._id === activeThreadId;
        const isRenaming = renamingId === thread._id;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            className: cn(
              "group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all",
              isActive ? "bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
            ),
            children: isRenaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-1 items-center gap-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  autoFocus: true,
                  value: renameValue,
                  onChange: (e) => setRenameValue(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") commitRename(thread._id);
                    if (e.key === "Escape") setRenamingId(null);
                  },
                  className: "w-full rounded bg-white px-2 py-0.5 text-xs text-zinc-900 outline-none ring-1 ring-blue-500 dark:bg-zinc-950 dark:text-zinc-100"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => commitRename(thread._id),
                  className: "p-1 text-emerald-500 hover:opacity-80",
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Check, { className: "size-3" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setRenamingId(null),
                  className: "p-1 text-red-500 hover:opacity-80",
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.X, { className: "size-3" })
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => onSelectThread(thread._id),
                  className: "flex flex-1 items-center gap-2 truncate text-left",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        className: cn(
                          "size-1.5 shrink-0 rounded-full",
                          isActive ? "bg-blue-500" : "bg-transparent"
                        )
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.MessageSquare, { className: "size-3.5 shrink-0 opacity-60" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "truncate", children: thread.title || "New Conversation" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                onRenameThread && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      startRename(thread);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Edit2, { className: "size-3" })
                  }
                ),
                onDeleteThread && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      onDeleteThread(thread._id);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-red-500",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Trash2, { className: "size-3" })
                  }
                )
              ] })
            ] })
          },
          thread._id
        );
      }) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: "fixed inset-0 z-20 bg-black/30 md:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "aside",
      {
        className: cn(
          "fixed inset-y-0 left-0 z-30 flex w-72 max-w-[80vw] flex-col border-r border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900",
          "md:static md:z-auto md:w-60 md:max-w-none md:shadow-none",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              onClick: onCreateThread,
              className: "flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Plus, { className: "size-3.5" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "New Chat" })
              ]
            }
          ) }),
          threads.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "relative my-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Search, { className: "absolute left-2.5 top-2 size-3.5 text-zinc-400" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: "Search conversations...",
                className: "w-full rounded-xl border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-3 flex-1 overflow-y-auto pr-1 scrollbar-thin", children: filteredThreads.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "p-4 text-center text-xs text-zinc-400", children: "No past conversations." }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            renderGroup("Today", groups.today),
            renderGroup("Yesterday", groups.yesterday),
            renderGroup("Previous 7 Days", groups.last7Days),
            renderGroup("Older", groups.older)
          ] }) })
        ]
      }
    )
  ] });
}

// src/components/PersonaMessageFeed.tsx
var import_react3 = require("react");

// src/components/PersonaToolTrace.tsx
var import_react2 = require("react");
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function groupSubagentActivity(entries) {
  const groups = [];
  for (const entry of entries) {
    if (entry.kind === "text") {
      const last = groups[groups.length - 1];
      if (last?.kind === "text") {
        last.text += entry.delta || "";
      } else {
        groups.push({ kind: "text", text: entry.delta || "" });
      }
    } else if (entry.kind === "tool_start") {
      groups.push({ kind: "tool_start", toolName: entry.toolName, args: entry.args });
    } else {
      groups.push({ kind: "tool_result", toolName: entry.toolName, result: entry.result });
    }
  }
  return groups;
}
function PersonaToolTrace({
  toolCall,
  toolRenderers,
  className
}) {
  const [isOpen, setIsOpen] = (0, import_react2.useState)(false);
  const parsedArgs = (0, import_react2.useMemo)(() => {
    if (!toolCall.args) return void 0;
    try {
      return JSON.parse(toolCall.args);
    } catch {
      return toolCall.args;
    }
  }, [toolCall.args]);
  const parsedResult = (0, import_react2.useMemo)(() => {
    if (!toolCall.result) return void 0;
    try {
      return JSON.parse(toolCall.result);
    } catch {
      return toolCall.result;
    }
  }, [toolCall.result]);
  const isExecuting = !toolCall.result && !toolCall.isError;
  const subagentGroups = (0, import_react2.useMemo)(
    () => toolCall.subagentActivity?.length ? groupSubagentActivity(toolCall.subagentActivity) : [],
    [toolCall.subagentActivity]
  );
  const CustomRenderer = toolRenderers?.[toolCall.toolName] || toolRenderers?.default;
  if (CustomRenderer && toolCall.result) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: cn("my-2", className), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      CustomRenderer,
      {
        toolCall,
        args: parsedArgs,
        result: parsedResult,
        isExecuting,
        isError: toolCall.isError
      }
    ) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      className: cn(
        "my-2 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            onClick: () => setIsOpen((prev) => !prev),
            className: "flex w-full items-center justify-between px-3 py-2 text-left font-mono transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Wrench, { className: "size-3.5 text-zinc-500" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-semibold text-zinc-800 dark:text-zinc-200", children: toolCall.toolName })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                isExecuting ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-blue-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "size-3 animate-spin" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Running..." })
                ] }) : toolCall.isError ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-red-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.AlertCircle, { className: "size-3" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Error" })
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-emerald-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.CheckCircle2, { className: "size-3" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Complete" })
                ] }),
                isOpen ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ChevronDown, { className: "size-3.5 text-zinc-400" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ChevronRight, { className: "size-3.5 text-zinc-400" })
              ] })
            ]
          }
        ),
        isOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border-t border-zinc-200/60 p-3 space-y-2 font-mono text-[11px] dark:border-zinc-800/60", children: [
          toolCall.args && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-zinc-500 block mb-1", children: "Arguments:" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedArgs === "object" ? JSON.stringify(parsedArgs, null, 2) : toolCall.args })
          ] }),
          toolCall.result && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-zinc-500 block mb-1", children: "Result:" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedResult === "object" ? JSON.stringify(parsedResult, null, 2) : toolCall.result })
          ] }),
          subagentGroups.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-zinc-500 mb-1 flex items-center gap-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Bot, { className: "size-3" }),
              "Subagent activity:"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "space-y-1.5 border-l-2 border-zinc-200 pl-2.5 dark:border-zinc-800", children: subagentGroups.map(
              (group, i) => group.kind === "text" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "whitespace-pre-wrap text-zinc-600 dark:text-zinc-400", children: group.text }, i) : group.kind === "tool_start" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1 text-zinc-500", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { className: "size-3 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-semibold", children: group.toolName }),
                group.args && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "truncate opacity-70", children: [
                  "(",
                  group.args,
                  ")"
                ] })
              ] }, i) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-start gap-1 text-emerald-600 dark:text-emerald-400", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.CheckCircle2, { className: "mt-0.5 size-3 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "truncate opacity-90", children: [
                  group.toolName,
                  ": ",
                  group.result
                ] })
              ] }, i)
            ) })
          ] })
        ] })
      ]
    }
  );
}

// src/components/PersonaMessageFeed.tsx
var import_lucide_react3 = require("lucide-react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function ReasoningBlock({ reasoning, isReasoning }) {
  const [isOpen, setIsOpen] = (0, import_react3.useState)(Boolean(isReasoning));
  (0, import_react3.useEffect)(() => {
    if (isReasoning) setIsOpen(true);
  }, [isReasoning]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mb-2 overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/60 text-xs dark:border-zinc-800/70 dark:bg-zinc-950/40", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen((prev) => !prev),
        className: "flex w-full items-center justify-between px-3 py-1.5 text-left text-zinc-500 transition-colors hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:bg-zinc-900/40",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "flex items-center gap-1.5", children: [
            isReasoning ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.Loader2, { className: "size-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.BrainCircuit, { className: "size-3" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-medium", children: isReasoning ? "Thinking\u2026" : "Thought process" })
          ] }),
          isOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.ChevronDown, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.ChevronRight, { className: "size-3" })
        ]
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "whitespace-pre-wrap border-t border-zinc-200/60 p-2.5 text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400", children: reasoning })
  ] });
}
function PersonaMessageFeed({
  messages,
  isStreaming,
  isLoading,
  error,
  toolRenderers,
  onReload,
  greeting = "How can I assist you today?",
  className
}) {
  const [copiedId, setCopiedId] = (0, import_react3.useState)(null);
  const scrollEndRef = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);
  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2e3);
  }
  if (messages.length === 0 && isLoading) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: cn("flex flex-1 items-center justify-center p-8", className), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" }) });
  }
  if (messages.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: cn("flex flex-1 flex-col items-center justify-center p-8 text-center", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.Sparkles, { className: "size-6" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { className: "text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl", children: greeting })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: cn("flex-1 space-y-6 overflow-y-auto p-4 md:p-6", className), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mx-auto max-w-3xl space-y-6", children: [
    messages.map((msg) => {
      const isUser = msg.role === "user";
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          className: cn(
            "flex gap-3 text-sm leading-relaxed",
            isUser ? "justify-end" : "justify-start"
          ),
          children: [
            !isUser && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 shadow-2xs dark:bg-zinc-800 dark:text-zinc-200 mt-0.5", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.Bot, { className: "size-4" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                className: cn(
                  "group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm",
                  isUser ? "bg-zinc-900 text-white font-medium rounded-tr-xs dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100/80 text-zinc-900 rounded-tl-xs border border-zinc-200/60 dark:bg-zinc-900/70 dark:text-zinc-100 dark:border-zinc-800/60"
                ),
                children: [
                  !isUser && msg.reasoning && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ReasoningBlock, { reasoning: msg.reasoning, isReasoning: msg.isReasoning }),
                  msg.toolCalls && msg.toolCalls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mb-2 space-y-1", children: msg.toolCalls.map((tc) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    PersonaToolTrace,
                    {
                      toolCall: tc,
                      toolRenderers
                    },
                    tc.toolCallId
                  )) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "whitespace-pre-wrap", children: msg.content }),
                  msg.isStreaming && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "inline-block size-2 ml-1 rounded-full bg-blue-500 animate-pulse" }),
                  !isUser && !msg.isStreaming && msg.content && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                    onReload && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "button",
                      {
                        type: "button",
                        onClick: onReload,
                        title: "Regenerate response",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.RotateCcw, { className: "size-3" })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleCopy(msg.content, msg.id),
                        title: "Copy message",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: copiedId === msg.id ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.Copy, { className: "size-3" })
                      }
                    )
                  ] })
                ]
              }
            ),
            isUser && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-200 text-zinc-700 shadow-2xs dark:bg-zinc-800 dark:text-zinc-300 mt-0.5", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react3.User, { className: "size-4" }) })
          ]
        },
        msg.id
      );
    }),
    error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400", children: error.message || "Failed to communicate with agent." }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: scrollEndRef })
  ] }) });
}

// src/components/PersonaComposer.tsx
var import_react4 = require("react");
var import_lucide_react4 = require("lucide-react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function PersonaComposer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask anything...",
  starterPrompts = [],
  onSelectStarter,
  onUploadFile,
  className
}) {
  const textareaRef = (0, import_react4.useRef)(null);
  const fileInputRef = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming && !disabled) {
        onSubmit();
      }
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: cn("relative w-full max-w-3xl mx-auto", className), children: [
    starterPrompts.length > 0 && !input && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mb-2 flex flex-wrap items-center gap-1.5 px-1", children: starterPrompts.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => onSelectStarter?.(item.prompt),
        className: "flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-2xs backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        children: [
          item.icon && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: item.icon }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: item.title })
        ]
      },
      item.title
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-zinc-700 dark:bg-zinc-900", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "textarea",
        {
          ref: textareaRef,
          value: input,
          onChange: (e) => onInputChange(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder,
          rows: 1,
          disabled,
          style: { color: "#111827" },
          className: "w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-sm leading-relaxed placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500 dark:!text-zinc-100"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between pt-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              ref: fileInputRef,
              type: "file",
              onChange: onUploadFile,
              className: "hidden"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              onClick: () => fileInputRef.current?.click(),
              title: "Attach document or receipt",
              className: "rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react4.Paperclip, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            onClick: onStop,
            className: "flex size-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-95",
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react4.Square, { className: "size-3.5 fill-white" })
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            onClick: onSubmit,
            disabled: !input.trim() || disabled,
            className: "flex size-8 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-sm transition-all hover:bg-zinc-700 disabled:opacity-25 disabled:pointer-events-none active:scale-95 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-100",
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react4.ArrowUp, { className: "size-4 stroke-[2.5]" })
          }
        ) })
      ] })
    ] })
  ] });
}

// src/components/PersonaFilesDrawer.tsx
var import_react5 = require("react");
var import_lucide_react5 = require("lucide-react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var TODO_ICON = {
  pending: import_lucide_react5.CircleDashed,
  in_progress: import_lucide_react5.CircleDotDashed,
  completed: import_lucide_react5.CircleCheck
};
function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  workspaceFiles = {},
  todos = [],
  presentedFile,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  className
}) {
  const [tab, setTab] = (0, import_react5.useState)("files");
  const [selectedWorkspacePath, setSelectedWorkspacePath] = (0, import_react5.useState)(null);
  const [selectedMemory, setSelectedMemory] = (0, import_react5.useState)(null);
  const [loadingMemory, setLoadingMemory] = (0, import_react5.useState)(false);
  const [copied, setCopied] = (0, import_react5.useState)(false);
  const workspaceEntries = Object.entries(workspaceFiles);
  (0, import_react5.useEffect)(() => {
    if (!presentedFile) return;
    setTab("workspace");
    setSelectedWorkspacePath(presentedFile.path);
  }, [presentedFile]);
  if (!isOpen) return null;
  async function viewMemoryFile(path) {
    if (!onGetMemoryFile) return;
    setLoadingMemory(true);
    try {
      const data = await onGetMemoryFile(path);
      setSelectedMemory(data);
    } catch {
      setSelectedMemory({ path, content: "Could not load memory file." });
    } finally {
      setLoadingMemory(false);
    }
  }
  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }
  const selectedWorkspaceFile = selectedWorkspacePath ? workspaceFiles[selectedWorkspacePath] : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        className: "fixed inset-0 z-20 bg-black/30 lg:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "aside",
      {
        className: cn(
          "fixed inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950 sm:max-w-sm",
          "lg:static lg:z-auto lg:w-80 lg:max-w-none lg:shrink-0 lg:bg-zinc-50/50 lg:shadow-none lg:backdrop-blur-md lg:dark:bg-zinc-950/50",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 p-3 dark:border-zinc-800/80", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("files"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "files" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Files, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "hidden sm:inline", children: "Files" }),
                    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      files.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("workspace"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "workspace" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.FolderKanban, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "hidden sm:inline", children: "Workspace" }),
                    workspaceEntries.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      workspaceEntries.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("memory"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "memory" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Brain, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "hidden sm:inline", children: "Memory" }),
                    memory?.userFiles?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      memory.userFiles.length,
                      ")"
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                onClick: onClose,
                className: "shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.X, { className: "size-4" })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex-1 overflow-y-auto p-3", children: tab === "files" ? (
            /* Uploaded files list */
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-2", children: files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No uploaded files yet." }) : files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                className: "flex items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 shadow-2xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.FileText, { className: "size-4 shrink-0 text-blue-500" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "min-w-0 truncate", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200", children: file.originalName }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ] })
                  ] }),
                  onDeleteFile && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => onDeleteFile(file.id),
                      className: "shrink-0 rounded p-1 text-zinc-400 hover:text-red-500",
                      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Trash2, { className: "size-3.5" })
                    }
                  )
                ]
              },
              file.id
            )) })
          ) : tab === "workspace" ? (
            /* Agent's own virtual workspace — plan (todos) + files it wrote */
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-4", children: selectedWorkspaceFile ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedWorkspacePath }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedWorkspaceFile.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Copy, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => setSelectedWorkspacePath(null),
                      className: "text-[11px] text-blue-500 hover:underline",
                      children: "Back"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedWorkspaceFile.content })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              todos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Plan" }),
                todos.map((todo, i) => {
                  const Icon = TODO_ICON[todo.status] ?? import_lucide_react5.CircleDashed;
                  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                    "div",
                    {
                      className: "flex items-start gap-2 rounded-xl border border-zinc-200/70 bg-white p-2 text-xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          Icon,
                          {
                            className: cn(
                              "mt-0.5 size-3.5 shrink-0",
                              todo.status === "completed" ? "text-emerald-500" : todo.status === "in_progress" ? "text-blue-500" : "text-zinc-400"
                            )
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          "span",
                          {
                            className: cn(
                              "text-zinc-700 dark:text-zinc-300",
                              todo.status === "completed" && "text-zinc-400 line-through dark:text-zinc-500"
                            ),
                            children: todo.content
                          }
                        )
                      ]
                    },
                    i
                  );
                })
              ] }),
              workspaceEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No workspace files yet \u2014 files the agent creates show up here." }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "space-y-1.5", children: [
                todos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Files" }),
                workspaceEntries.map(([path, file]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedWorkspacePath(path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.FileText, { className: "size-3.5 shrink-0 text-amber-500" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: path })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "shrink-0 text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ]
                  },
                  path
                ))
              ] })
            ] }) })
          ) : (
            /* Memory inspector */
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-3", children: selectedMemory ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedMemory.path }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedMemory.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Copy, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => setSelectedMemory(null),
                      className: "text-[11px] text-blue-500 hover:underline",
                      children: "Back"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedMemory.content })
            ] }) : (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No persistent memory files recorded." }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "space-y-4", children: [
              (memory?.userFiles?.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-1.5", children: memory.userFiles.map((f) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => viewMemoryFile(f.path),
                  className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Brain, { className: "size-3.5 shrink-0 text-purple-500" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                    ] }),
                    loadingMemory && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Loader2, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
                  ]
                },
                f.path
              )) }),
              memory?.agentMemories?.map((group) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: group.agentName || "Unknown Agent" }),
                group.files.map((f) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: () => viewMemoryFile(f.path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Brain, { className: "size-3.5 shrink-0 text-purple-500" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                      ] }),
                      loadingMemory && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Loader2, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
                    ]
                  },
                  f.path
                ))
              ] }, group.agentId))
            ] }) })
          ) })
        ]
      }
    )
  ] });
}

// src/components/PersonaInterruptCard.tsx
var import_react6 = require("react");
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function PersonaInterruptCard({
  interrupt,
  onRespond,
  isStreaming,
  className
}) {
  const [answers, setAnswers] = (0, import_react6.useState)({});
  if (interrupt.kind === "hitl") {
    const approveAll = () => {
      onRespond(
        { decisions: interrupt.actionRequests.map(() => ({ type: "approve" })) },
        "Approved"
      );
    };
    const rejectAll = () => {
      onRespond(
        {
          decisions: interrupt.actionRequests.map(() => ({
            type: "reject",
            message: "User declined the action."
          }))
        },
        "Rejected"
      );
    };
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        className: cn(
          "mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.ShieldAlert, { className: "size-4" }),
            "Approval needed"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "mb-3 space-y-1 font-mono text-xs text-amber-900/80 dark:text-amber-200/80", children: interrupt.actionRequests.map((action, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { children: [
            "\u2022 ",
            action.name
          ] }, i)) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: approveAll,
                className: "flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.Check, { className: "size-3.5" }),
                  " Approve"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: rejectAll,
                className: "flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.X, { className: "size-3.5" }),
                  " Reject"
                ]
              }
            )
          ] })
        ]
      }
    );
  }
  const submit = () => {
    const orderedAnswers = interrupt.questions.map((_, i) => answers[i] ?? "");
    const summary = interrupt.questions.map((q, i) => `${q.text}: ${answers[i] ?? ""}`).join("\n");
    onRespond({ answers: orderedAnswers, text: summary }, summary);
  };
  const canSubmit = !interrupt.questions.some((q, i) => q.required && !answers[i]?.trim());
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      className: cn(
        "mx-auto w-full max-w-3xl rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mb-3 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.HelpCircle, { className: "size-4" }),
          "A few questions before I continue"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "space-y-3", children: interrupt.questions.map((q, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mb-1.5 text-xs font-medium text-blue-900 dark:text-blue-200", children: q.text }),
          q.options.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mb-1.5 flex flex-wrap gap-1.5", children: q.options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setAnswers((prev) => ({ ...prev, [i]: opt })),
              className: cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors",
                answers[i] === opt ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-blue-700 ring-blue-200 hover:bg-blue-100 dark:bg-zinc-900 dark:text-blue-300 dark:ring-blue-900/60"
              ),
              children: opt
            },
            opt
          )) }),
          q.allowCustom && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              value: q.options.includes(answers[i] ?? "") ? "" : answers[i] || "",
              onChange: (e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value })),
              placeholder: "Or type your own answer...",
              className: "w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-blue-400 dark:border-blue-900/60 dark:bg-zinc-900 dark:text-zinc-100"
            }
          )
        ] }, q.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            disabled: isStreaming || !canSubmit,
            onClick: submit,
            className: "mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40",
            children: "Submit"
          }
        )
      ]
    }
  );
}

// src/components/PersonaChatView.tsx
var import_lucide_react7 = require("lucide-react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function PersonaChatView({
  agentId,
  threadId: controlledThreadId,
  onThreadChange,
  greeting = "How can I assist you today?",
  title = "AI Assistant",
  starterPrompts = [],
  toolRenderers,
  classNames = {},
  theme,
  showSidebar = true,
  showFilesDrawer = true,
  className
}) {
  const [internalThreadId, setInternalThreadId] = (0, import_react7.useState)(void 0);
  const activeThreadId = controlledThreadId !== void 0 ? controlledThreadId : internalThreadId;
  const [sidebarOpen, setSidebarOpen] = (0, import_react7.useState)(showSidebar);
  const [filesDrawerOpen, setFilesDrawerOpen] = (0, import_react7.useState)(false);
  (0, import_react7.useEffect)(() => {
    if (showSidebar && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);
  const { threads, createThread, deleteThread, renameThread } = (0, import_react8.useThreads)();
  const { files, uploadFile, deleteFile } = (0, import_react8.useFiles)();
  const { memory, getFile, deleteFile: deleteMemoryFile } = (0, import_react8.useMemory)();
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    resumeInterrupt,
    files: workspaceFiles,
    todos,
    presentedFile,
    stop,
    reload,
    clear
  } = (0, import_react8.useChat)({ agentId, threadId: activeThreadId });
  const setActiveThread = (0, import_react7.useCallback)(
    (id) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );
  const handleSelectThread = (0, import_react7.useCallback)(
    (id) => {
      clear();
      setActiveThread(id);
    },
    [clear, setActiveThread]
  );
  const handleNewChat = (0, import_react7.useCallback)(() => {
    clear();
    setActiveThread(void 0);
  }, [clear, setActiveThread]);
  const handleSend = (0, import_react7.useCallback)(
    async (content) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const t = await createThread(agentId);
          tid = t?._id;
          if (tid) setActiveThread(tid);
        } catch {
        }
      }
      void sendMessage(content, tid ? { threadId: tid } : void 0);
    },
    [activeThreadId, agentId, createThread, sendMessage, setActiveThread]
  );
  (0, import_react7.useEffect)(() => {
    if (presentedFile) setFilesDrawerOpen(true);
  }, [presentedFile]);
  const handleUploadFile = (0, import_react7.useCallback)(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        await uploadFile(fd);
        setFilesDrawerOpen(true);
      } catch {
      }
    },
    [uploadFile]
  );
  const themeStyles = theme ? {
    "--persona-primary": theme.primaryColor,
    "--persona-bg": theme.backgroundColor,
    "--persona-card": theme.cardBackgroundColor,
    "--persona-text": theme.textColor,
    borderRadius: theme.borderRadius
  } : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: themeStyles,
      className: cn(
        // Fill whatever height the host container provides — no internal height set
        "flex w-full overflow-hidden bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        // Host page is responsible for the height; component just fills it
        "h-full min-h-0",
        classNames.root,
        className
      ),
      children: [
        sidebarOpen && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          PersonaSidebar,
          {
            threads,
            activeThreadId,
            onSelectThread: handleSelectThread,
            onCreateThread: handleNewChat,
            onDeleteThread: deleteThread,
            onRenameThread: renameThread,
            onClose: () => setSidebarOpen(false),
            className: classNames.sidebar
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cn("flex min-h-0 flex-1 flex-col", classNames.main), children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setSidebarOpen((p) => !p),
                  className: "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                  children: sidebarOpen ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react7.PanelLeftClose, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react7.PanelLeft, { className: "size-4" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "text-sm font-semibold text-zinc-800 dark:text-zinc-200", children: title })
            ] }),
            showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
              "button",
              {
                type: "button",
                onClick: () => setFilesDrawerOpen((p) => !p),
                className: cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filesDrawerOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                ),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react7.Files, { className: "size-3.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "Artifacts" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "min-h-0 flex-1 overflow-y-auto", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            PersonaMessageFeed,
            {
              messages,
              isStreaming,
              isLoading: isLoadingHistory,
              error,
              toolRenderers,
              onReload: reload,
              greeting,
              className: classNames.messageList
            }
          ) }),
          interrupt && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "shrink-0 border-t border-zinc-100 bg-white px-3 pt-3 dark:border-zinc-800 dark:bg-zinc-950", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            PersonaInterruptCard,
            {
              interrupt,
              isStreaming,
              onRespond: (resume, displayContent) => void resumeInterrupt(resume, displayContent)
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: cn(
            "shrink-0 border-t border-zinc-100 bg-white px-3 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950",
            classNames.composer
          ), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            PersonaComposer,
            {
              input,
              onInputChange: setInput,
              onSubmit: () => void handleSend(),
              onStop: stop,
              isStreaming,
              starterPrompts: messages.length === 0 ? starterPrompts : [],
              onSelectStarter: (p) => void handleSend(p),
              onUploadFile: handleUploadFile
            }
          ) })
        ] }),
        showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          PersonaFilesDrawer,
          {
            isOpen: filesDrawerOpen,
            onClose: () => setFilesDrawerOpen(false),
            files,
            memory,
            workspaceFiles,
            todos,
            presentedFile,
            onDeleteFile: deleteFile,
            onGetMemoryFile: (path) => getFile({ path }),
            onDeleteMemoryFile: (path) => deleteMemoryFile({ path }),
            className: classNames.filesDrawer
          }
        )
      ]
    }
  );
}

// src/index.ts
var VERSION = "0.3.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersonaChatView,
  PersonaComposer,
  PersonaFilesDrawer,
  PersonaInterruptCard,
  PersonaMessageFeed,
  PersonaSidebar,
  PersonaToolTrace,
  VERSION,
  cn
});
//# sourceMappingURL=index.cjs.map