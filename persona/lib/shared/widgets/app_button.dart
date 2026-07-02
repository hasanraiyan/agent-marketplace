import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/colors.dart';
import '../../core/theme/typography.dart';

/// Button variant controls visual style.
enum AppButtonVariant { primary, secondary, outline, ghost, danger }

/// App-wide button component with loading state, icon support and
/// multiple visual variants.
///
/// ```dart
/// AppButton(
///   label: 'Get Started',
///   onPressed: () {},
/// )
///
/// AppButton.outline(
///   label: 'Cancel',
///   onPressed: () {},
/// )
/// ```
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.leadingIcon,
    this.trailingIcon,
    this.variant = AppButtonVariant.primary,
    this.width,
    this.height = 52,
    this.borderRadius = 12,
    this.textStyle,
  });

  // ── Named constructors for common variants ──────────────────────────────────
  const AppButton.outline({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.leadingIcon,
    this.trailingIcon,
    this.width,
    this.height = 52,
    this.borderRadius = 12,
    this.textStyle,
  }) : variant = AppButtonVariant.outline;

  const AppButton.ghost({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.leadingIcon,
    this.trailingIcon,
    this.width,
    this.height = 52,
    this.borderRadius = 12,
    this.textStyle,
  }) : variant = AppButtonVariant.ghost;

  const AppButton.danger({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.leadingIcon,
    this.trailingIcon,
    this.width,
    this.height = 52,
    this.borderRadius = 12,
    this.textStyle,
  }) : variant = AppButtonVariant.danger;

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final Widget? leadingIcon;
  final Widget? trailingIcon;
  final AppButtonVariant variant;
  final double? width;
  final double height;
  final double borderRadius;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final (bg, fg, border) = _colors(colorScheme, isDark);

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: onPressed == null && !isLoading ? 0.5 : 1.0,
      child:
          SizedBox(
                width: width ?? double.infinity,
                height: height,
                child: Material(
                  color: bg,
                  borderRadius: BorderRadius.circular(borderRadius),
                  child: InkWell(
                    onTap: isLoading ? null : onPressed,
                    borderRadius: BorderRadius.circular(borderRadius),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(borderRadius),
                        border: border != null
                            ? Border.all(color: border, width: 1.5)
                            : null,
                      ),
                      child: Center(
                        child: isLoading
                            ? SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: fg,
                                ),
                              )
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (leadingIcon != null) ...[
                                    leadingIcon!,
                                    const SizedBox(width: 8),
                                  ],
                                  Text(
                                    label,
                                    style:
                                        (textStyle ?? AppTypography.labelLarge)
                                            .copyWith(color: fg),
                                  ),
                                  if (trailingIcon != null) ...[
                                    const SizedBox(width: 8),
                                    trailingIcon!,
                                  ],
                                ],
                              ),
                      ),
                    ),
                  ),
                ),
              )
              .animate()
              .fadeIn(duration: 200.ms)
              .slideY(begin: 0.05, end: 0, duration: 200.ms),
    );
  }

  (Color bg, Color fg, Color? border) _colors(ColorScheme cs, bool isDark) =>
      switch (variant) {
        AppButtonVariant.primary => (
          isDark ? AppColors.primaryDark : AppColors.primaryLight,
          Colors.white,
          null,
        ),
        AppButtonVariant.secondary => (
          isDark
              ? AppColors.secondaryDark.withValues(alpha: 0.15)
              : AppColors.secondaryLight.withValues(alpha: 0.10),
          isDark ? AppColors.secondaryDark : AppColors.secondaryLight,
          null,
        ),
        AppButtonVariant.outline => (
          Colors.transparent,
          isDark ? AppColors.primaryDark : AppColors.primaryLight,
          isDark ? AppColors.primaryDark : AppColors.primaryLight,
        ),
        AppButtonVariant.ghost => (
          Colors.transparent,
          isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
          null,
        ),
        AppButtonVariant.danger => (
          AppColors.error.withValues(alpha: 0.10),
          AppColors.error,
          AppColors.error,
        ),
      };
}
