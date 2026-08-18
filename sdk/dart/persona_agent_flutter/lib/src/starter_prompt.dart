/// One quick-action suggestion shown above the composer before the first
/// message is sent — mirrors `StarterPromptItem` from `sdk/ui`'s types.
class StarterPromptItem {
  const StarterPromptItem({required this.title, required this.prompt, this.icon});

  final String title;
  final String prompt;

  /// An emoji or short glyph shown before [title] — kept as a plain string
  /// (not an `IconData`) so consumers can pass an emoji without pulling in
  /// an icon font.
  final String? icon;
}
