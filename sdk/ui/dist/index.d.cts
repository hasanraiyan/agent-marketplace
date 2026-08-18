import React, { ReactNode, ComponentType } from 'react';
import { PersonaToolCall, PersonaThread, PersonaMessage, PersonaFileItem, PersonaMemoryList, PersonaMemoryFile, PersonaInterrupt, PersonaResumeValue } from '@personaai/react';
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
interface PersonaCustomTheme {
    primaryColor?: string;
    backgroundColor?: string;
    cardBackgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
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
    className?: string;
    children?: ReactNode;
}

declare function cn(...inputs: ClassValue[]): string;

declare function PersonaChatView({ agentId, threadId: controlledThreadId, onThreadChange, greeting, title, starterPrompts, toolRenderers, classNames, theme, showSidebar, showFilesDrawer, className, }: PersonaChatViewProps): React.JSX.Element;

interface PersonaSidebarProps {
    threads: PersonaThread[];
    activeThreadId?: string;
    onSelectThread: (threadId: string | undefined) => void;
    onCreateThread: () => void;
    onDeleteThread?: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
    className?: string;
}
declare function PersonaSidebar({ threads, activeThreadId, onSelectThread, onCreateThread, onDeleteThread, onRenameThread, className, }: PersonaSidebarProps): React.JSX.Element;

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
    greeting?: string;
    className?: string;
}
declare function PersonaMessageFeed({ messages, isStreaming, isLoading, error, toolRenderers, onReload, greeting, className, }: PersonaMessageFeedProps): React.JSX.Element;

interface PersonaToolTraceProps {
    toolCall: PersonaToolCall;
    toolRenderers?: ToolRendererMap;
    className?: string;
}
declare function PersonaToolTrace({ toolCall, toolRenderers, className, }: PersonaToolTraceProps): React.JSX.Element;

interface PersonaFilesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    files: PersonaFileItem[];
    memory: PersonaMemoryList;
    onDeleteFile?: (fileId: string) => void;
    onGetMemoryFile?: (path: string) => Promise<PersonaMemoryFile>;
    onDeleteMemoryFile?: (path: string) => Promise<void>;
    className?: string;
}
declare function PersonaFilesDrawer({ isOpen, onClose, files, memory, onDeleteFile, onGetMemoryFile, onDeleteMemoryFile, className, }: PersonaFilesDrawerProps): React.JSX.Element | null;

interface PersonaInterruptCardProps {
    interrupt: PersonaInterrupt;
    onRespond: (resume: PersonaResumeValue, displayContent: string) => void;
    isStreaming?: boolean;
    className?: string;
}
declare function PersonaInterruptCard({ interrupt, onRespond, isStreaming, className, }: PersonaInterruptCardProps): React.JSX.Element;

declare const VERSION = "0.2.0";

export { type ClassNamesOverride, PersonaChatView, type PersonaChatViewProps, PersonaComposer, type PersonaComposerProps, type PersonaCustomTheme, PersonaFilesDrawer, type PersonaFilesDrawerProps, PersonaInterruptCard, type PersonaInterruptCardProps, PersonaMessageFeed, type PersonaMessageFeedProps, PersonaSidebar, type PersonaSidebarProps, PersonaToolTrace, type PersonaToolTraceProps, type StarterPromptItem, type ToolRendererMap, type ToolRendererProps, VERSION, cn };
