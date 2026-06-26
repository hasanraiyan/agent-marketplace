import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';

/// Persistent shell wrapping all 4 bottom-nav tabs.
///
/// On phones (portrait) → Material 3 [NavigationBar] at the bottom.
/// On tablets & landscape  → [NavigationRail] on the left side.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _indexFromLocation(location);

    final size = MediaQuery.sizeOf(context);
    final isWide = size.width >= 600 || size.width > size.height;

    if (isWide) {
      return _WideShell(selectedIndex: selectedIndex, child: child);
    }
    return _NarrowShell(selectedIndex: selectedIndex, child: child);
  }

  static int _indexFromLocation(String location) {
    if (location.startsWith('/chats')) return 1;
    if (location.startsWith('/agents')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0; // marketplace
  }
}

// ── Destinations ──────────────────────────────────────────────────────────────

const _destinations = [
  _TabDestination(
    icon: Icons.explore_outlined,
    selectedIcon: Icons.explore_rounded,
    label: 'Marketplace',
    route: RouteNames.marketplace,
  ),
  _TabDestination(
    icon: Icons.chat_bubble_outline_rounded,
    selectedIcon: Icons.chat_bubble_rounded,
    label: 'Chats',
    route: RouteNames.chats,
  ),
  _TabDestination(
    icon: Icons.auto_awesome_outlined,
    selectedIcon: Icons.auto_awesome_rounded,
    label: 'My Agents',
    route: RouteNames.myAgents,
  ),
  _TabDestination(
    icon: Icons.person_outline_rounded,
    selectedIcon: Icons.person_rounded,
    label: 'Profile',
    route: RouteNames.profile,
  ),
];

class _TabDestination {
  const _TabDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String route;
}

// ── Narrow layout (phone portrait) ────────────────────────────────────────────

class _NarrowShell extends StatelessWidget {
  const _NarrowShell({required this.selectedIndex, required this.child});

  final int selectedIndex;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (i) => _navigate(context, i),
        backgroundColor:
            isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        surfaceTintColor: Colors.transparent,
        indicatorColor: (isDark ? AppColors.primaryDark : AppColors.primaryLight)
            .withValues(alpha: 0.12),
        destinations: _destinations.map((d) {
          return NavigationDestination(
            icon: Icon(d.icon, color: cs.onSurfaceVariant),
            selectedIcon: Icon(
              d.selectedIcon,
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
            ),
            label: d.label,
          );
        }).toList(),
      ),
    );
  }

  void _navigate(BuildContext context, int index) {
    context.go(_destinations[index].route);
  }
}

// ── Wide layout (tablet / landscape) ─────────────────────────────────────────

class _WideShell extends StatelessWidget {
  const _WideShell({required this.selectedIndex, required this.child});

  final int selectedIndex;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final size = MediaQuery.sizeOf(context);
    final isTablet = size.width >= 600;

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: selectedIndex,
            onDestinationSelected: (i) => context.go(_destinations[i].route),
            extended: isTablet,
            backgroundColor:
                isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
            indicatorColor: (isDark
                    ? AppColors.primaryDark
                    : AppColors.primaryLight)
                .withValues(alpha: 0.12),
            selectedIconTheme: IconThemeData(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
            ),
            unselectedIconTheme:
                IconThemeData(color: cs.onSurfaceVariant),
            selectedLabelTextStyle: TextStyle(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
            unselectedLabelTextStyle: TextStyle(
              color: cs.onSurfaceVariant,
              fontSize: 13,
            ),
            destinations: _destinations.map((d) {
              return NavigationRailDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.selectedIcon),
                label: Text(d.label),
              );
            }).toList(),
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}
