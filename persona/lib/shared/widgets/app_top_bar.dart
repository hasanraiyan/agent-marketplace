import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/colors.dart';
import '../../core/theme/typography.dart';
import '../../features/shell/presentation/pages/main_shell.dart';

/// Consistent top bar for every screen.
///
/// - Root screens (canPop == false) → hamburger that opens the side drawer.
/// - Sub-screens  (canPop == true)  → styled back arrow.
class AppTopBar extends StatelessWidget {
  const AppTopBar({
    super.key,
    this.title,
    this.actions = const [],
    this.bottom,
  });

  final String? title;
  final List<Widget> actions;

  /// Optional widget rendered below the title row (e.g. a search field).
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canPop = context.canPop();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 6),
          child: Row(
            children: [
              AppNavButton(isDark: isDark, canPop: canPop),
              const SizedBox(width: 6),
              if (title != null)
                Expanded(
                  child: Text(
                    title!,
                    style: AppTypography.titleLarge.copyWith(
                      color: isDark
                          ? AppColors.textPrimaryDark
                          : AppColors.textPrimaryLight,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                )
              else
                const Spacer(),
              ...actions,
              if (actions.isNotEmpty) const SizedBox(width: 4),
            ],
          ),
        ),
        ?bottom,
      ],
    );
  }
}

/// The hamburger / back-arrow button — usable standalone too.
class AppNavButton extends StatelessWidget {
  const AppNavButton({super.key, required this.isDark, required this.canPop});
  final bool isDark;
  final bool canPop;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: canPop
          ? () => context.pop()
          : () => shellScaffoldKey.currentState?.openDrawer(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Icon(
          canPop ? Icons.arrow_back_rounded : Icons.menu_rounded,
          size: 20,
          color: isDark
              ? AppColors.textPrimaryDark
              : AppColors.textPrimaryLight,
        ),
      ),
    );
  }
}
