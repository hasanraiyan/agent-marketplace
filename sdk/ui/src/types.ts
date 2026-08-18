import type { ReactNode, ComponentType } from 'react';
import type { PersonaMessage, PersonaThread, PersonaToolCall } from '@personaai/react';

export interface StarterPromptItem {
  title: string;
  prompt: string;
  icon?: string | ReactNode;
}

export interface ToolRendererProps {
  toolCall: PersonaToolCall;
  args?: Record<string, unknown> | string;
  result?: Record<string, unknown> | string;
  isExecuting?: boolean;
  isError?: boolean;
}

export type ToolRendererMap = Record<
  string,
  ComponentType<ToolRendererProps>
>;

export interface ClassNamesOverride {
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
export interface PersonaCustomTheme {
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

export interface PersonaChatViewProps {
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
