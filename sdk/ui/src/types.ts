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

export interface PersonaCustomTheme {
  primaryColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
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
  className?: string;
  children?: ReactNode;
}
