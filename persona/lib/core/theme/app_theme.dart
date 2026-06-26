import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flex_color_scheme/flex_color_scheme.dart';

import 'colors.dart';

/// Central theme configuration for Persona.ai.
///
/// Uses [FlexColorScheme] for consistent Material-3 theming and
/// [GoogleFonts] for typography.
class AppTheme {
  AppTheme._();

  // ── Light Theme ─────────────────────────────────────────────────────────────
  static ThemeData get light {
    final base = FlexColorScheme.light(
      scheme: FlexScheme.custom,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primaryLight,
        secondary: AppColors.secondaryLight,
        surface: AppColors.surfaceLight,
        error: AppColors.error,
      ),
      useMaterial3: true,
      fontFamily: GoogleFonts.outfit().fontFamily,
    ).toTheme;

    return base.copyWith(
      textTheme: _buildTextTheme(base.textTheme, isLight: true),
      appBarTheme: _appBarTheme(isLight: true),
      elevatedButtonTheme: _elevatedButtonTheme(isLight: true),
      outlinedButtonTheme: _outlinedButtonTheme(isLight: true),
      inputDecorationTheme: _inputDecorationTheme(isLight: true),
      cardTheme: _cardThemeData(isLight: true),
      chipTheme: _chipTheme(isLight: true),
      bottomNavigationBarTheme: _bottomNavTheme(isLight: true),
      dividerTheme: const DividerThemeData(
        color: AppColors.dividerLight,
        thickness: 1,
      ),
    );
  }

  // ── Dark Theme ──────────────────────────────────────────────────────────────
  static ThemeData get dark {
    final base = FlexColorScheme.dark(
      scheme: FlexScheme.custom,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primaryDark,
        secondary: AppColors.secondaryDark,
        surface: AppColors.surfaceDark,
        error: AppColors.error,
      ),
      useMaterial3: true,
      fontFamily: GoogleFonts.outfit().fontFamily,
    ).toTheme;

    return base.copyWith(
      textTheme: _buildTextTheme(base.textTheme, isLight: false),
      appBarTheme: _appBarTheme(isLight: false),
      elevatedButtonTheme: _elevatedButtonTheme(isLight: false),
      outlinedButtonTheme: _outlinedButtonTheme(isLight: false),
      inputDecorationTheme: _inputDecorationTheme(isLight: false),
      cardTheme: _cardThemeData(isLight: false),
      chipTheme: _chipTheme(isLight: false),
      bottomNavigationBarTheme: _bottomNavTheme(isLight: false),
      dividerTheme: const DividerThemeData(
        color: AppColors.dividerDark,
        thickness: 1,
      ),
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  static TextTheme _buildTextTheme(TextTheme base, {required bool isLight}) {
    final color = isLight
        ? AppColors.textPrimaryLight
        : AppColors.textPrimaryDark;
    return GoogleFonts.outfitTextTheme(
      base,
    ).apply(bodyColor: color, displayColor: color);
  }

  static AppBarTheme _appBarTheme({required bool isLight}) => AppBarTheme(
    elevation: 0,
    centerTitle: true,
    backgroundColor: isLight ? AppColors.surfaceLight : AppColors.surfaceDark,
    foregroundColor: isLight
        ? AppColors.textPrimaryLight
        : AppColors.textPrimaryDark,
    titleTextStyle: GoogleFonts.outfit(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: isLight ? AppColors.textPrimaryLight : AppColors.textPrimaryDark,
    ),
  );

  static ElevatedButtonThemeData _elevatedButtonTheme({
    required bool isLight,
  }) => ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: isLight ? AppColors.primaryLight : AppColors.primaryDark,
      foregroundColor: Colors.white,
      minimumSize: const Size(double.infinity, 52),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
      elevation: 0,
    ),
  );

  static OutlinedButtonThemeData _outlinedButtonTheme({
    required bool isLight,
  }) => OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: isLight ? AppColors.primaryLight : AppColors.primaryDark,
      minimumSize: const Size(double.infinity, 52),
      side: BorderSide(
        color: isLight ? AppColors.primaryLight : AppColors.primaryDark,
        width: 1.5,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
    ),
  );

  static InputDecorationTheme _inputDecorationTheme({required bool isLight}) =>
      InputDecorationTheme(
        filled: true,
        fillColor: isLight ? Colors.white : AppColors.inputFillDark,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isLight ? AppColors.dividerLight : AppColors.dividerDark,
            width: 1,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isLight ? AppColors.dividerLight : AppColors.dividerDark,
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isLight ? AppColors.primaryLight : AppColors.primaryDark,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        hintStyle: TextStyle(
          color: isLight
              ? AppColors.textSecondaryLight
              : AppColors.textSecondaryDark,
          fontSize: 14,
        ),
      );

  static CardThemeData _cardThemeData({required bool isLight}) => CardThemeData(
    elevation: 0,
    color: isLight ? AppColors.cardLight : AppColors.cardDark,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  );

  static ChipThemeData _chipTheme({required bool isLight}) => ChipThemeData(
    backgroundColor: isLight
        ? AppColors.chipBackgroundLight
        : AppColors.chipBackgroundDark,
    selectedColor: isLight ? AppColors.primaryLight : AppColors.primaryDark,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
  );

  static BottomNavigationBarThemeData _bottomNavTheme({
    required bool isLight,
  }) => BottomNavigationBarThemeData(
    backgroundColor: isLight ? AppColors.surfaceLight : AppColors.surfaceDark,
    selectedItemColor: isLight ? AppColors.primaryLight : AppColors.primaryDark,
    unselectedItemColor: isLight
        ? AppColors.textSecondaryLight
        : AppColors.textSecondaryDark,
    showUnselectedLabels: true,
    type: BottomNavigationBarType.fixed,
    elevation: 0,
  );
}
