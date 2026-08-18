import * as React$1 from 'react';
import React__default, { ComponentType, ReactNode, CSSProperties, ChangeEvent } from 'react';
import * as _personaai_react from '@personaai/react';
import { PersonaToolCall, PersonaThread, PersonaMessage, PersonaFileItem, PersonaMemoryList, PersonaWorkspaceFile, PersonaTodo, PersonaPresentedFile, PersonaMemoryFile, PersonaInterrupt, PersonaResumeValue, PersonaMcpConnection } from '@personaai/react';
import { ClassValue } from 'clsx';

interface PersonaToolClusterMeta {
    title: string;
    icon?: ComponentType<{
        className?: string;
    }>;
}
/** Keyed by `toolGroupKey`'s return value — `mixed` is the fallback when a group's tools don't share one key. */
type PersonaToolClusterLabels = Record<string, PersonaToolClusterMeta>;
/**
 * Which semantic family a tool belongs to, for the cluster header. Memory is
 * detected by name AND by file ops touching /memories/ paths, matching how
 * persona.hasanraiyan.me's own frontend classifies tools for the same purpose.
 */
declare function toolGroupKey(tool: PersonaToolCall): string;
interface PersonaToolGroupItem {
    type: 'single' | 'group';
    tools: PersonaToolCall[];
}
/**
 * Clusters consecutive tool calls from one message into groups a
 * `PersonaToolGroup` can render as one collapsible unit, instead of one card
 * per call. `present_file` never joins a group — its whole purpose is
 * "highlight this file", which a generic "N steps" cluster header would bury.
 */
declare function groupToolCalls(toolCalls: PersonaToolCall[]): PersonaToolGroupItem[];

interface StarterPromptItem {
    title: string;
    prompt: string;
    icon?: string | ReactNode;
}
interface ToolRendererProps {
    toolCall: PersonaToolCall;
    args?: Record<string, unknown> | string;
    result?: Record<string, unknown> | string;
    isExecuting?: boolean;
    isError?: boolean;
}
type ToolRendererMap = Record<string, ComponentType<ToolRendererProps>>;
interface ClassNamesOverride {
    root?: string;
    sidebar?: string;
    main?: string;
    header?: string;
    composer?: string;
    messageList?: string;
    messageUser?: string;
    messageAssistant?: string;
    filesDrawer?: string;
}
/**
 * Every color here is applied uniformly across light and dark mode (the same
 * value both times) — set via CSS custom properties that each component's
 * light *and* dark Tailwind classes both fall back to when unset, so an
 * unthemed app keeps its normal zinc palette in both modes, and a themed one
 * gets its brand color in both modes without needing separate light/dark
 * values here.
 */
interface PersonaCustomTheme {
    primaryColor?: string;
    backgroundColor?: string;
    cardBackgroundColor?: string;
    textColor?: string;
    mutedTextColor?: string;
    borderColor?: string;
    borderRadius?: string;
    userMessageBg?: string;
    userMessageText?: string;
    assistantMessageBg?: string;
    assistantMessageText?: string;
    userAvatarBg?: string;
    userAvatarText?: string;
    assistantAvatarBg?: string;
    assistantAvatarText?: string;
}
interface PersonaChatViewProps {
    agentId?: string;
    threadId?: string;
    onThreadChange?: (threadId: string | undefined) => void;
    greeting?: string;
    title?: string;
    starterPrompts?: StarterPromptItem[];
    toolRenderers?: ToolRendererMap;
    classNames?: ClassNamesOverride;
    theme?: PersonaCustomTheme;
    showSidebar?: boolean;
    showFilesDrawer?: boolean;
    /** Shows a "Connect" prompt above the composer for any user-mode MCP this Agent needs that isn't authorized yet. @default true */
    showMcpConnectBanner?: boolean;
    /** @default true */
    showUserAvatar?: boolean;
    /** @default true */
    showAssistantAvatar?: boolean;
    /** Replaces the default user-icon avatar entirely (e.g. a profile picture). */
    userAvatar?: ReactNode;
    /** Replaces the default bot-icon avatar entirely. */
    assistantAvatar?: ReactNode;
    /** Clusters consecutive tool calls into one collapsible group instead of one card each. @default true */
    groupTools?: boolean;
    /** Overrides/extends the default tool-cluster title+icon map (see `PersonaToolGroup`). */
    toolClusterLabels?: PersonaToolClusterLabels;
    className?: string;
    children?: ReactNode;
}

declare function cn(...inputs: ClassValue[]): string;

declare function PersonaChatView({ agentId, threadId: controlledThreadId, onThreadChange, greeting, title, starterPrompts, toolRenderers, classNames, theme, showSidebar, showFilesDrawer, showMcpConnectBanner, showUserAvatar, showAssistantAvatar, userAvatar, assistantAvatar, groupTools, toolClusterLabels, className, }: PersonaChatViewProps): React$1.JSX.Element;

interface PersonaChatLauncherProps extends PersonaChatViewProps {
    /** @default 'bottom-right' */
    position?: 'bottom-right' | 'bottom-left';
    /** Uncontrolled initial open state. @default false */
    defaultOpen?: boolean;
    /** Controlled open state — omit to let the launcher manage it internally. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Replaces the default chat-bubble icon (shown while closed). */
    fabIcon?: React__default.ReactNode;
    /** @default '24rem' */
    panelWidth?: string;
    /** @default '36rem' */
    panelHeight?: string;
    fabClassName?: string;
    panelClassName?: string;
}
/**
 * A floating action button that toggles a `PersonaChatView` panel — for
 * mounting a chat bubble on any page (a support-widget-style entry point),
 * rather than a dedicated full-page chat route. Accepts every
 * `PersonaChatViewProps` and passes them straight through to the panel.
 */
declare function PersonaChatLauncher({ position, defaultOpen, open: controlledOpen, onOpenChange, fabIcon, panelWidth, panelHeight, fabClassName, panelClassName, theme, ...chatViewProps }: PersonaChatLauncherProps): React__default.JSX.Element;

interface PersonaSidebarProps {
    threads: PersonaThread[];
    activeThreadId?: string;
    onSelectThread: (threadId: string | undefined) => void;
    onCreateThread: () => void;
    onDeleteThread?: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
    /** Dismisses the sidebar on mobile, where it overlays instead of docking inline. */
    onClose?: () => void;
    /** Shows thread-row placeholders instead of the empty state while the initial list loads. */
    isLoading?: boolean;
    className?: string;
}
declare function PersonaSidebar({ threads, activeThreadId, onSelectThread, onCreateThread, onDeleteThread, onRenameThread, onClose, isLoading, className, }: PersonaSidebarProps): React__default.JSX.Element;

interface PersonaComposerProps {
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
    onStop?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
    placeholder?: string;
    starterPrompts?: StarterPromptItem[];
    onSelectStarter?: (prompt: string) => void;
    onUploadFile?: (e: React__default.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}
declare function PersonaComposer({ input, onInputChange, onSubmit, onStop, isStreaming, disabled, placeholder, starterPrompts, onSelectStarter, onUploadFile, className, }: PersonaComposerProps): React__default.JSX.Element;

interface PersonaMessageFeedProps {
    messages: PersonaMessage[];
    isStreaming?: boolean;
    isLoading?: boolean;
    error?: Error | null;
    toolRenderers?: ToolRendererMap;
    onReload?: () => void;
    /** Called when a present_file tool card's "Open" button is clicked. */
    onOpenFile?: (path: string) => void;
    greeting?: string;
    showUserAvatar?: boolean;
    showAssistantAvatar?: boolean;
    userAvatar?: React__default.ReactNode;
    assistantAvatar?: React__default.ReactNode;
    /** Clusters consecutive tool calls into one collapsible group instead of one card each. @default true */
    groupTools?: boolean;
    /** Overrides/extends the default tool-cluster title+icon map. */
    toolClusterLabels?: PersonaToolClusterLabels;
    className?: string;
}
declare function PersonaMessageFeed({ messages, isStreaming, isLoading, error, toolRenderers, onReload, onOpenFile, greeting, showUserAvatar, showAssistantAvatar, userAvatar, assistantAvatar, groupTools, toolClusterLabels, className, }: PersonaMessageFeedProps): React__default.JSX.Element;

interface PersonaMarkdownProps {
    content: string;
    className?: string;
}
/**
 * Renders assistant message content as Markdown — GFM (tables, strikethrough,
 * task lists), LaTeX ($inline$ / $$block$$ via KaTeX), and fenced code blocks
 * with a copy button.
 *
 * No rehype-raw / rehype-sanitize: react-markdown never parses raw HTML found
 * in the source text by default (it renders as literal escaped text) — that's
 * the actual XSS boundary here, and it's already in effect without either
 * plugin. Adding sanitize on top would need a KaTeX-aware schema (its output
 * classes aren't in rehype-sanitize's default allowlist) for no additional
 * safety, so it's deliberately left out rather than risked being misconfigured.
 */
declare function PersonaMarkdown({ content, className }: PersonaMarkdownProps): React__default.JSX.Element;

interface PersonaToolTraceProps {
    toolCall: PersonaToolCall;
    toolRenderers?: ToolRendererMap;
    /** Called when the user clicks "Open" on a present_file card. */
    onOpenFile?: (path: string) => void;
    /**
     * Whether the parent message is an actively-streaming live run (pass the
     * message's own `isStreaming`). A reloaded historical tool call has no
     * live "in progress" signal — `!toolCall.result` there doesn't reliably
     * mean "still running" the way it does mid-stream — so without this a
     * completed historical call could show "Running..." with a spinner on
     * every page load. @default false
     */
    isLive?: boolean;
    className?: string;
}
declare function PersonaToolTrace({ toolCall, toolRenderers, onOpenFile, isLive, className, }: PersonaToolTraceProps): React__default.JSX.Element;

interface PersonaToolGroupProps {
    tools: PersonaToolCall[];
    toolRenderers?: ToolRendererMap;
    onOpenFile?: (path: string) => void;
    /** Overrides/extends the default cluster title+icon map (keyed by `toolGroupKey`'s output, or `mixed`). */
    clusterLabels?: PersonaToolClusterLabels;
    /**
     * Whether the parent message is an actively-streaming live run (pass the
     * message's own `isStreaming`). Gates whether `anyRunning` is trusted to
     * mean anything: a reloaded historical message's tool calls have no
     * live "in progress" signal (they're just whatever the server happened to
     * persist), so `!tool.result` there doesn't reliably mean "still running"
     * the way it does mid-stream — without this, a completed historical group
     * could auto-expand on every page load looking like it's re-running.
     * @default false
     */
    isLive?: boolean;
    className?: string;
}
declare function PersonaToolGroup({ tools, toolRenderers, onOpenFile, clusterLabels, isLive, className, }: PersonaToolGroupProps): React__default.JSX.Element;

interface PersonaFilesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    files: PersonaFileItem[];
    memory: PersonaMemoryList;
    /** The agent's own virtual workspace files (deepagents' write_file/read_file), distinct from uploads. */
    workspaceFiles?: Record<string, PersonaWorkspaceFile>;
    todos?: PersonaTodo[];
    /** Set when the agent calls `present_file` — auto-opens the Workspace tab on that file. */
    presentedFile?: PersonaPresentedFile | null;
    onDeleteFile?: (fileId: string) => void;
    onGetMemoryFile?: (path: string) => Promise<PersonaMemoryFile>;
    onDeleteMemoryFile?: (path: string) => Promise<void>;
    /** Shows row placeholders on the Files tab instead of the empty state while the initial list loads. */
    isFilesLoading?: boolean;
    /** Shows row placeholders on the Memory tab instead of the empty state while the initial list loads. */
    isMemoryLoading?: boolean;
    className?: string;
}
declare function PersonaFilesDrawer({ isOpen, onClose, files, memory, workspaceFiles, todos, presentedFile, onDeleteFile, onGetMemoryFile, onDeleteMemoryFile, isFilesLoading, isMemoryLoading, className, }: PersonaFilesDrawerProps): React__default.JSX.Element | null;

interface PersonaInterruptCardProps {
    interrupt: PersonaInterrupt;
    onRespond: (resume: PersonaResumeValue, displayContent: string) => void;
    isStreaming?: boolean;
    className?: string;
}
declare function PersonaInterruptCard({ interrupt, onRespond, isStreaming, className, }: PersonaInterruptCardProps): React__default.JSX.Element;

interface PersonaSkeletonProps {
    className?: string;
}
/**
 * Shimmering placeholder block, themed the same way as every other surface
 * (`--persona-border` for the base tone) so it reads correctly against a
 * custom `theme` instead of assuming the default zinc palette.
 */
declare function PersonaSkeleton({ className }: PersonaSkeletonProps): React$1.JSX.Element;
/** Placeholder for a single chat bubble row, matching PersonaMessageFeed's real layout. */
declare function PersonaMessageSkeletonRow({ align }: {
    align?: 'left' | 'right';
}): React$1.JSX.Element;
/** Placeholder for a single thread row in PersonaSidebar. */
declare function PersonaThreadSkeletonRow(): React$1.JSX.Element;
/** Placeholder for a single file/memory row in PersonaFilesDrawer. */
declare function PersonaFileSkeletonRow(): React$1.JSX.Element;

interface PersonaMcpConnectBannerProps {
    connections: PersonaMcpConnection[];
    className?: string;
}
/**
 * One "Connect" prompt per MCP the agent needs that the current user hasn't
 * authorized yet — the affordance that didn't exist at all before
 * `useMcpConnections`: a tool call against one of these used to just
 * silently not work, with nothing anywhere telling the user why.
 *
 * A plain `<a>`, not a click handler: `authorizeUrl` is a real OAuth
 * authorization URL, and a same-tab navigation there and back (the OAuth
 * server redirects to `returnTo` once consent completes) is the correct,
 * standards-based way to start that flow — nothing here needs to be a popup
 * or an XHR.
 */
declare function PersonaMcpConnectBanner({ connections, className }: PersonaMcpConnectBannerProps): React$1.JSX.Element | null;

declare function isWebSearchTool(name: string): boolean;
declare function isKbSearchTool(name: string): boolean;
declare function isKbListSourcesTool(name: string): boolean;
declare function isGrepTool(name: string): boolean;
declare function isReadFileTool(name: string): boolean;
declare function isLsTool(name: string): boolean;
declare function isFileWriteTool(name: string): boolean;
declare function isFileEditTool(name: string): boolean;
declare function isSubagentTool(name: string): boolean;
declare function getToolIcon(toolName: string): ComponentType<{
    className?: string;
}>;
declare function queryFromArgs(args: unknown): string;
declare function getToolTitle(toolName: string, args: unknown, status: 'running' | 'completed'): string;
declare function getDomain(url: string): string;
interface PersonaSearchResult {
    title?: string;
    url?: string;
}
declare function searchResults(result: unknown): PersonaSearchResult[];
interface PersonaLsEntry {
    name: string;
    isDir: boolean;
}
declare function parseLsResults(result: unknown): PersonaLsEntry[];
interface PersonaGrepMatch {
    file: string;
    line: number;
    content: string;
}
declare function parseGrepResults(result: unknown): PersonaGrepMatch[];
type DiffRow = {
    type: 'context' | 'add' | 'remove';
    line: string;
};
declare function computeLineDiff(oldLines: string[], newLines: string[]): DiffRow[];
interface PersonaDiffStats {
    added: number;
    removed: number;
}
declare function computeFileDiffStats(toolName: string, args: unknown): PersonaDiffStats | null;
declare function getFilePathFromArgs(args: unknown): string;

interface PersonaSearchResultsCardProps {
    results: PersonaSearchResult[];
    status: 'running' | 'completed';
    className?: string;
}
declare function PersonaSearchResultsCard({ results, status, className }: PersonaSearchResultsCardProps): React__default.JSX.Element;

interface PersonaReadFileCardProps {
    filePath: string;
    content: string;
    status: 'running' | 'completed';
    lineOffset?: number;
    className?: string;
}
declare function PersonaReadFileCard({ filePath, content, status, lineOffset, className }: PersonaReadFileCardProps): React__default.JSX.Element;

interface PersonaLsDirectoryCardProps {
    path: string;
    entries: PersonaLsEntry[];
    status: 'running' | 'completed';
    className?: string;
}
declare function PersonaLsDirectoryCard({ path, entries, status, className }: PersonaLsDirectoryCardProps): React__default.JSX.Element;

interface PersonaGrepResultsCardProps {
    query: string;
    path: string;
    matches: PersonaGrepMatch[];
    status: 'running' | 'completed';
    className?: string;
}
declare function PersonaGrepResultsCard({ query, path, matches, status, className }: PersonaGrepResultsCardProps): React__default.JSX.Element;

interface PersonaFileDiffCardProps {
    filePath: string;
    oldContent: string;
    newContent: string;
    note?: string;
    className?: string;
}
declare function PersonaFileDiffCard({ filePath, oldContent, newContent, note, className }: PersonaFileDiffCardProps): React__default.JSX.Element;

/**
 * Turns a `PersonaCustomTheme` into the CSS custom properties every
 * component reads via `var(--x, <default>)`. Only sets the vars a caller
 * actually provided — React omits an `undefined` style property entirely, so
 * every unset one correctly falls through to its own class's fallback
 * instead of resolving to the literal string "undefined".
 *
 * Shared between `PersonaChatView` (sets it on its own root) and
 * `PersonaChatLauncher` (needs the SAME vars available to its FAB button too
 * — a sibling of `PersonaChatView`'s subtree, not a descendant, so it can't
 * inherit vars `PersonaChatView` sets on its own root alone).
 */
declare function buildThemeStyles(theme: PersonaCustomTheme | undefined): CSSProperties | undefined;

interface UsePersonaChatWidgetOptions {
    agentId?: string;
    /** Controlled active thread — omit to let the hook manage it internally. */
    threadId?: string;
    onThreadChange?: (threadId: string | undefined) => void;
    /** Initial sidebar visibility, auto-corrected closed on a mobile viewport on mount. @default true */
    defaultSidebarOpen?: boolean;
}
/**
 * Every stateful/behavioral piece `PersonaChatView` is built on — thread
 * selection, lazy thread creation on the first message, sidebar/files-drawer
 * open state, the present_file auto-open effect — extracted into its own
 * hook. `PersonaChatView` is just one layout built on top of this; a
 * consumer assembling its own layout (composer somewhere else, a floating
 * widget, a custom sidebar) can call this directly instead of reimplementing
 * the same wiring against the raw `useChat`/`useThreads` hooks.
 */
declare function usePersonaChatWidget(options?: UsePersonaChatWidgetOptions): {
    workspaceFiles: Record<string, _personaai_react.PersonaWorkspaceFile>;
    handleSelectThread: (id: string | undefined) => void;
    handleNewChat: () => void;
    handleSend: (content?: string) => void;
    handleUploadFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    messages: _personaai_react.PersonaMessage[];
    input: string;
    setInput: React$1.Dispatch<React$1.SetStateAction<string>>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSubmit: (e?: React.FormEvent) => void;
    sendMessage: (contentToSend?: string, overrideOptions?: _personaai_react.SendMessageOverride) => Promise<void>;
    isStreaming: boolean;
    isLoading: boolean;
    isLoadingHistory: boolean;
    error: Error | null;
    interrupt: _personaai_react.PersonaInterrupt | null;
    resumeInterrupt: (resume: _personaai_react.PersonaResumeValue, displayContent: string) => Promise<void>;
    todos: _personaai_react.PersonaTodo[];
    presentedFile: _personaai_react.PersonaPresentedFile | null;
    dismissPresentedFile: () => void;
    openWorkspaceFile: (path: string) => void;
    stop: () => void;
    reload: () => void;
    clear: () => void;
    setMessages: React$1.Dispatch<React$1.SetStateAction<_personaai_react.PersonaMessage[]>>;
    loadThreadMessages: (id: string) => Promise<_personaai_react.PersonaMessage[]>;
    activeThreadId: string | undefined;
    setActiveThread: (id: string | undefined) => void;
    sidebarOpen: boolean;
    setSidebarOpen: React$1.Dispatch<React$1.SetStateAction<boolean>>;
    filesDrawerOpen: boolean;
    setFilesDrawerOpen: React$1.Dispatch<React$1.SetStateAction<boolean>>;
    threads: _personaai_react.PersonaThread[];
    deleteThread: (threadId: string) => Promise<void>;
    renameThread: (threadId: string, title: string) => Promise<_personaai_react.PersonaThread>;
    threadsLoading: boolean;
    files: _personaai_react.PersonaFileItem[];
    deleteFile: (fileId: string) => Promise<void>;
    filesLoading: boolean;
    memory: _personaai_react.PersonaMemoryList;
    getMemoryFile: (params: {
        path: string;
        scope?: "user" | "agent";
        agentId?: string;
    }) => Promise<_personaai_react.PersonaMemoryFile>;
    deleteMemoryFile: (params: {
        path: string;
        scope?: "user" | "agent";
        agentId?: string;
    }) => Promise<void>;
    memoryLoading: boolean;
    unconnectedMcps: _personaai_react.PersonaMcpConnection[];
    mcpConnectionsLoading: boolean;
};

declare const VERSION = "0.8.0";

export { type ClassNamesOverride, type DiffRow, PersonaChatLauncher, type PersonaChatLauncherProps, PersonaChatView, type PersonaChatViewProps, PersonaComposer, type PersonaComposerProps, type PersonaCustomTheme, type PersonaDiffStats, PersonaFileDiffCard, type PersonaFileDiffCardProps, PersonaFileSkeletonRow, PersonaFilesDrawer, type PersonaFilesDrawerProps, type PersonaGrepMatch, PersonaGrepResultsCard, type PersonaGrepResultsCardProps, PersonaInterruptCard, type PersonaInterruptCardProps, PersonaLsDirectoryCard, type PersonaLsDirectoryCardProps, type PersonaLsEntry, PersonaMarkdown, type PersonaMarkdownProps, PersonaMcpConnectBanner, type PersonaMcpConnectBannerProps, PersonaMessageFeed, type PersonaMessageFeedProps, PersonaMessageSkeletonRow, PersonaReadFileCard, type PersonaReadFileCardProps, type PersonaSearchResult, PersonaSearchResultsCard, type PersonaSearchResultsCardProps, PersonaSidebar, type PersonaSidebarProps, PersonaSkeleton, type PersonaSkeletonProps, PersonaThreadSkeletonRow, type PersonaToolClusterLabels, type PersonaToolClusterMeta, PersonaToolGroup, type PersonaToolGroupItem, type PersonaToolGroupProps, PersonaToolTrace, type PersonaToolTraceProps, type StarterPromptItem, type ToolRendererMap, type ToolRendererProps, type UsePersonaChatWidgetOptions, VERSION, buildThemeStyles, cn, computeFileDiffStats, computeLineDiff, getDomain, getFilePathFromArgs, getToolIcon, getToolTitle, groupToolCalls, isFileEditTool, isFileWriteTool, isGrepTool, isKbListSourcesTool, isKbSearchTool, isLsTool, isReadFileTool, isSubagentTool, isWebSearchTool, parseGrepResults, parseLsResults, queryFromArgs, searchResults, toolGroupKey, usePersonaChatWidget };
