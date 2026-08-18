import type { CSSProperties } from 'react';
import type { PersonaCustomTheme } from '../types.js';

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
export function buildThemeStyles(theme: PersonaCustomTheme | undefined): CSSProperties | undefined {
  if (!theme) return undefined;
  return {
    '--persona-primary': theme.primaryColor,
    '--persona-bg': theme.backgroundColor,
    '--persona-card': theme.cardBackgroundColor,
    '--persona-text': theme.textColor,
    '--persona-muted-text': theme.mutedTextColor,
    '--persona-border': theme.borderColor,
    '--persona-user-bg': theme.userMessageBg,
    '--persona-user-text': theme.userMessageText,
    '--persona-assistant-bg': theme.assistantMessageBg,
    '--persona-assistant-text': theme.assistantMessageText,
    '--persona-user-avatar-bg': theme.userAvatarBg,
    '--persona-user-avatar-text': theme.userAvatarText,
    '--persona-assistant-avatar-bg': theme.assistantAvatarBg,
    '--persona-assistant-avatar-text': theme.assistantAvatarText,
    borderRadius: theme.borderRadius,
  } as CSSProperties;
}
