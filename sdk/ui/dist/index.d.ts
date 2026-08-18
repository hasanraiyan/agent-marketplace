import React, { ReactNode, ComponentType } from 'react';
import { PersonaToolCall, PersonaThread, PersonaMessage, PersonaFileItem, PersonaMemoryList, PersonaWorkspaceFile, PersonaTodo, PersonaPresentedFile, PersonaMemoryFile, PersonaInterrupt, PersonaResumeValue } from '@personaai/react';
import { ClassValue } from 'clsx';

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
    /** @default true */
    showUserAvatar?: boolean;
    /** @default true */
    showAssistantAvatar?: boolean;
    /** Replaces the default user-icon avatar entirely (e.g. a profile picture). */
    userAvatar?: ReactNode;
    /** Replaces the default bot-icon avatar entirely. */
    assistantAvatar?: ReactNode;
    className?: string;
    children?: ReactNode;
}

declare function cn(...inputs: ClassValue[]): string;

declare function PersonaChatView({ agentId, threadId: controlledThreadId, onThreadChange, greeting, title, starterPrompts, toolRenderers, classNames, theme, showSidebar, showFilesDrawer, showUserAvatar, showAssistantAvatar, userAvatar, assistantAvatar, className, }: PersonaChatViewProps): React.JSX.Element;

interface PersonaSidebarProps {
    threads: PersonaThread[];
    activeThreadId?: string;
    onSelectThread: (threadId: string | undefined) => void;
    onCreateThread: () => void;
    onDeleteThread?: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
    /** Dismisses the sidebar on mobile, where it overlays instead of docking inline. */
    onClose?: () => void;
    className?: string;
}
declare function PersonaSidebar({ threads, activeThreadId, onSelectThread, onCreateThread, onDeleteThread, onRenameThread, onClose, className, }: PersonaSidebarProps): React.JSX.Element;

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
    onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}
declare function PersonaComposer({ input, onInputChange, onSubmit, onStop, isStreaming, disabled, placeholder, starterPrompts, onSelectStarter, onUploadFile, className, }: PersonaComposerProps): React.JSX.Element;

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
    userAvatar?: React.ReactNode;
    assistantAvatar?: React.ReactNode;
    className?: string;
}
declare function PersonaMessageFeed({ messages, isStreaming, isLoading, error, toolRenderers, onReload, onOpenFile, greeting, showUserAvatar, showAssistantAvatar, userAvatar, assistantAvatar, className, }: PersonaMessageFeedProps): React.JSX.Element;

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
declare function PersonaMarkdown({ content, className }: PersonaMarkdownProps): React.JSX.Element;

interface PersonaToolTraceProps {
    toolCall: PersonaToolCall;
    toolRenderers?: ToolRendererMap;
    /** Called when the user clicks "Open" on a present_file card. */
    onOpenFile?: (path: string) => void;
    className?: string;
}
declare function PersonaToolTrace({ toolCall, toolRenderers, onOpenFile, className, }: PersonaToolTraceProps): React.JSX.Element;

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
    className?: string;
}
declare function PersonaFilesDrawer({ isOpen, onClose, files, memory, workspaceFiles, todos, presentedFile, onDeleteFile, onGetMemoryFile, onDeleteMemoryFile, className, }: PersonaFilesDrawerProps): React.JSX.Element | null;

interface PersonaInterruptCardProps {
    interrupt: PersonaInterrupt;
    onRespond: (resume: PersonaResumeValue, displayContent: string) => void;
    isStreaming?: boolean;
    className?: string;
}
declare function PersonaInterruptCard({ interrupt, onRespond, isStreaming, className, }: PersonaInterruptCardProps): React.JSX.Element;

declare const VERSION = "0.4.0";

export { type ClassNamesOverride, PersonaChatView, type PersonaChatViewProps, PersonaComposer, type PersonaComposerProps, type PersonaCustomTheme, PersonaFilesDrawer, type PersonaFilesDrawerProps, PersonaInterruptCard, type PersonaInterruptCardProps, PersonaMarkdown, type PersonaMarkdownProps, PersonaMessageFeed, type PersonaMessageFeedProps, PersonaSidebar, type PersonaSidebarProps, PersonaToolTrace, type PersonaToolTraceProps, type StarterPromptItem, type ToolRendererMap, type ToolRendererProps, VERSION, cn };
