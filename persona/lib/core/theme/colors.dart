import 'package:flutter/material.dart';

/// All design tokens for the Persona.ai color palette.
///
/// Adapted from the agent-marketplace frontend colors (oklch conversions).
class AppColors {
  AppColors._();

  // ── Brand / Primary ─────────────────────────────────────────────────────────
  /// Vibrant indigo/blue — light mode primary (oklch(0.488 0.243 264.376) -> #1447e6)
  static const Color primaryLight = Color(0xFF1447E6);

  /// Sleek indigo/blue tint — dark mode primary (highly legible on dark surfaces)
  static const Color primaryDark = Color(0xFF537CFA);

  // ── Secondary / Accent ──────────────────────────────────────────────────────
  /// Light zinc background (oklch(0.967 0.001 286.375) -> #f4f4f5)
  static const Color secondaryLight = Color(0xFFF4F4F5);

  /// Dark zinc background (oklch(0.21 0.006 285.885) -> #18181b)
  static const Color secondaryDark = Color(0xFF18181B);

  // ── Surfaces ────────────────────────────────────────────────────────────────
  static const Color surfaceLight = Color(0xFFFAFAFA);
  static const Color surfaceDark = Color(0xFF1C1917); // stone-900 (#1c1917)

  static const Color backgroundLight = Color(0xFFFFFFFF);
  static const Color backgroundDark = Color(0xFF0C0A09); // stone-950 deep black (#0c0a09)

  // ── Cards ───────────────────────────────────────────────────────────────────
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color cardDark = Color(0xFF1C1917);

  // ── Text ────────────────────────────────────────────────────────────────────
  static const Color textPrimaryLight = Color(0xFF0C0A09);
  static const Color textSecondaryLight = Color(0xFF78716C); // stone-500 (#78716c)

  static const Color textPrimaryDark = Color(0xFFF5F5F4); // stone-100 (#f5f5f4)
  static const Color textSecondaryDark = Color(0xFFA8A29E); // stone-400 (#a8a29e)

  // ── Input fills ─────────────────────────────────────────────────────────────
  static const Color inputFillLight = Color(0xFFF5F5F4);
  static const Color inputFillDark = Color(0xFF292524); // stone-800 (#292524)

  // ── Chip backgrounds ────────────────────────────────────────────────────────
  static const Color chipBackgroundLight = Color(0xFFECEBFA);
  static const Color chipBackgroundDark = Color(0xFF1B233D);

  // ── Dividers ────────────────────────────────────────────────────────────────
  static const Color dividerLight = Color(0xFFE7E5E4); // stone-200 (#e7e5e4)
  static const Color dividerDark = Color(0xFF292524); // stone-800 (#292524)

  // ── Semantic ────────────────────────────────────────────────────────────────
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF1447E6);

  // ── Gradients ───────────────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF1447E6), Color(0xFF537CFA)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
