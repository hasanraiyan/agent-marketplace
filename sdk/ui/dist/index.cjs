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
var import_react6 = require("react");
var import_react7 = require("@personaai/react");

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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "aside",
    {
      className: cn(
        "flex w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-50/50 p-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/50",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            onClick: onCreateThread,
            className: "flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Plus, { className: "size-3.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "New Chat" })
            ]
          }
        ),
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
  );
}

// src/components/PersonaMessageFeed.tsx
var import_react3 = require("react");

// src/components/PersonaToolTrace.tsx
var import_react2 = require("react");
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime2 = require("react/jsx-runtime");
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
          ] })
        ] })
      ]
    }
  );
}

// src/components/PersonaMessageFeed.tsx
var import_lucide_react3 = require("lucide-react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function PersonaMessageFeed({
  messages,
  isStreaming,
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
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-2.5 shadow-md transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600", children: [
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
          className: "w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 md:text-sm"
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
            className: "flex size-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
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
function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  className
}) {
  const [tab, setTab] = (0, import_react5.useState)("files");
  const [selectedMemory, setSelectedMemory] = (0, import_react5.useState)(null);
  const [loadingMemory, setLoadingMemory] = (0, import_react5.useState)(false);
  const [copied, setCopied] = (0, import_react5.useState)(false);
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
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "aside",
    {
      className: cn(
        "flex w-80 shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50/50 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/50",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between border-b border-zinc-200/80 p-3 dark:border-zinc-800/80", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "button",
              {
                type: "button",
                onClick: () => setTab("files"),
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  tab === "files" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                ),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Files, { className: "size-3.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Files" }),
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
                onClick: () => setTab("memory"),
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  tab === "memory" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                ),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Brain, { className: "size-3.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Memory" }),
                  memory?.user?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                    "(",
                    memory.user.length,
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
              className: "rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.X, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex-1 overflow-y-auto p-3", children: tab === "files" ? (
          /* Files list */
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-2", children: files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No uploaded files yet." }) : files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              className: "flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 shadow-2xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-2 truncate", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.FileText, { className: "size-4 shrink-0 text-blue-500" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "truncate", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200", children: file.filename }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[10px] text-zinc-400", children: file.sizeBytes ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : "" })
                  ] })
                ] }),
                onDeleteFile && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => onDeleteFile(file._id),
                    className: "rounded p-1 text-zinc-400 hover:text-red-500",
                    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Trash2, { className: "size-3.5" })
                  }
                )
              ]
            },
            file._id
          )) })
        ) : (
          /* Memory inspector */
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-3", children: selectedMemory ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedMemory.path }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-1", children: [
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
          ] }) : memory?.user?.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No persistent memory files recorded." }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-1.5", children: memory?.user?.map((f) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => viewMemoryFile(f.path),
              className: "flex w-full items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-2 truncate", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Brain, { className: "size-3.5 text-purple-500" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                ] }),
                loadingMemory && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react5.Loader2, { className: "size-3 animate-spin text-zinc-400" })
              ]
            },
            f.path
          )) }) })
        ) })
      ]
    }
  );
}

// src/components/PersonaChatView.tsx
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime6 = require("react/jsx-runtime");
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
  const [internalThreadId, setInternalThreadId] = (0, import_react6.useState)(void 0);
  const activeThreadId = controlledThreadId !== void 0 ? controlledThreadId : internalThreadId;
  const [sidebarOpen, setSidebarOpen] = (0, import_react6.useState)(showSidebar);
  const [filesDrawerOpen, setFilesDrawerOpen] = (0, import_react6.useState)(false);
  const { threads, createThread, deleteThread } = (0, import_react7.useThreads)();
  const { files, uploadFile, deleteFile } = (0, import_react7.useFiles)();
  const { memory, getFile, deleteFile: deleteMemoryFile } = (0, import_react7.useMemory)();
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    error,
    stop,
    reload,
    clear
  } = (0, import_react7.useChat)({
    agentId,
    threadId: activeThreadId
  });
  const handleSelectThread = (0, import_react6.useCallback)(
    (id) => {
      clear();
      if (onThreadChange) {
        onThreadChange(id);
      } else {
        setInternalThreadId(id);
      }
    },
    [clear, onThreadChange]
  );
  const handleCreateThread = (0, import_react6.useCallback)(async () => {
    clear();
    const newThread = await createThread(agentId);
    if (newThread?._id) {
      handleSelectThread(newThread._id);
    }
  }, [clear, createThread, agentId, handleSelectThread]);
  const handleUploadFile = (0, import_react6.useCallback)(
    async (e) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];
      const formData = new FormData();
      formData.append("file", file);
      try {
        await uploadFile(formData);
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: themeStyles,
      className: cn(
        "relative flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white font-sans text-zinc-900 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-100",
        classNames.root,
        className
      ),
      children: [
        sidebarOpen && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          PersonaSidebar,
          {
            threads,
            activeThreadId,
            onSelectThread: handleSelectThread,
            onCreateThread: handleCreateThread,
            onDeleteThread: deleteThread,
            className: classNames.sidebar
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: cn("relative flex flex-1 flex-col overflow-hidden", classNames.main), children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex h-12 items-center justify-between border-b border-zinc-200/80 px-4 backdrop-blur-sm dark:border-zinc-800/80", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setSidebarOpen((prev) => !prev),
                  title: sidebarOpen ? "Collapse sidebar" : "Open sidebar",
                  className: "rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                  children: sidebarOpen ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.PanelLeftClose, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.PanelLeft, { className: "size-4" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-xs font-semibold text-zinc-700 dark:text-zinc-300", children: title })
            ] }),
            showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                onClick: () => setFilesDrawerOpen((prev) => !prev),
                title: filesDrawerOpen ? "Close files panel" : "Open files & memory",
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  filesDrawerOpen ? "bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                ),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react6.Files, { className: "size-3.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "Artifacts" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            PersonaMessageFeed,
            {
              messages,
              isStreaming,
              error,
              toolRenderers,
              onReload: reload,
              greeting,
              className: classNames.messageList
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "p-3 md:p-4", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            PersonaComposer,
            {
              input,
              onInputChange: setInput,
              onSubmit: () => void sendMessage(),
              onStop: stop,
              isStreaming,
              starterPrompts: messages.length === 0 ? starterPrompts : [],
              onSelectStarter: (prompt) => void sendMessage(prompt),
              onUploadFile: handleUploadFile,
              className: classNames.composer
            }
          ) })
        ] }),
        showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          PersonaFilesDrawer,
          {
            isOpen: filesDrawerOpen,
            onClose: () => setFilesDrawerOpen(false),
            files,
            memory,
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
var VERSION = "0.1.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersonaChatView,
  PersonaComposer,
  PersonaFilesDrawer,
  PersonaMessageFeed,
  PersonaSidebar,
  PersonaToolTrace,
  VERSION,
  cn
});
//# sourceMappingURL=index.cjs.map