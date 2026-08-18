# Changelog

## 0.1.0

- Initial release. Flutter port of `@personaai/ui`, built on
  `persona_agent_client`:
  - `PersonaChatView` / `PersonaChatLauncher` — composition roots.
  - `PersonaMessageFeed` / `PersonaMessageBubble` — transcript rendering
    with Markdown support and avatar overrides.
  - `PersonaToolTrace` / `PersonaToolGroup` + specialized tool cards
    (search results, read-file, `ls`, grep, file diff).
  - `PersonaSubagentActivityDialog` — recursive subagent activity detail
    view.
  - `PersonaInterruptCard`, `PersonaFilesDrawer`, `PersonaSidebar`,
    `PersonaMcpConnectBanner`, `PersonaSkeleton`.
  - `PersonaChatTheme` (`ThemeExtension`) for light/dark theming, starter
    prompts, tool-renderer overrides, and cluster-label overrides.
