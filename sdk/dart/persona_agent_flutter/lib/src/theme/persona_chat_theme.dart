import 'package:flutter/material.dart';

/// Mirrors `sdk/ui`'s CSS custom-property theming (`--persona-bg`,
/// `--persona-text`, `--persona-border`, `--persona-card`,
/// `--persona-primary`) as a Flutter [ThemeExtension] — register it via
/// `Theme(data: ThemeData(extensions: [PersonaChatTheme.light]), ...)`, or
/// let widgets fall back to [PersonaChatTheme.of] which derives light/dark
/// from ambient [Brightness] when nothing's registered.
@immutable
class PersonaChatTheme extends ThemeExtension<PersonaChatTheme> {
  const PersonaChatTheme({
    required this.background,
    required this.text,
    required this.border,
    required this.card,
    required this.primary,
    required this.primaryText,
  });

  final Color background;
  final Color text;
  final Color border;
  final Color card;
  final Color primary;
  final Color primaryText;

  static const light = PersonaChatTheme(
    background: Color(0xFFFFFFFF),
    text: Color(0xFF18181B),
    border: Color(0xFFE4E4E7),
    card: Color(0xFFFAFAFA),
    primary: Color(0xFF27272A),
    primaryText: Color(0xFFFFFFFF),
  );

  static const dark = PersonaChatTheme(
    background: Color(0xFF09090B),
    text: Color(0xFFF4F4F5),
    border: Color(0xFF27272A),
    card: Color(0xFF18181B),
    primary: Color(0xFFE4E4E7),
    primaryText: Color(0xFF18181B),
  );

  @override
  PersonaChatTheme copyWith({
    Color? background,
    Color? text,
    Color? border,
    Color? card,
    Color? primary,
    Color? primaryText,
  }) {
    return PersonaChatTheme(
      background: background ?? this.background,
      text: text ?? this.text,
      border: border ?? this.border,
      card: card ?? this.card,
      primary: primary ?? this.primary,
      primaryText: primaryText ?? this.primaryText,
    );
  }

  @override
  PersonaChatTheme lerp(covariant ThemeExtension<PersonaChatTheme>? other, double t) {
    if (other is! PersonaChatTheme) return this;
    return PersonaChatTheme(
      background: Color.lerp(background, other.background, t)!,
      text: Color.lerp(text, other.text, t)!,
      border: Color.lerp(border, other.border, t)!,
      card: Color.lerp(card, other.card, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryText: Color.lerp(primaryText, other.primaryText, t)!,
    );
  }

  static PersonaChatTheme of(BuildContext context) {
    final theme = Theme.of(context).extension<PersonaChatTheme>();
    if (theme != null) return theme;
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}
