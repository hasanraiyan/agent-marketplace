import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../chat_thread/presentation/widgets/sidebar_thread_list.dart';

// Direct key so any screen can open the drawer without context lookup
final shellScaffoldKey = GlobalKey<ScaffoldState>();

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _indexFromLocation(location);
    final isWide = MediaQuery.sizeOf(context).width >= 840;

    if (isWide) {
      return _WideShell(selectedIndex: selectedIndex, child: child);
    }
    return _NarrowShell(selectedIndex: selectedIndex, child: child);
  }

  static int _indexFromLocation(String location) {
    if (location.startsWith('/agents')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }
}

// ── Nav items data ─────────────────────────────────────────────────────────────

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;
}

const _navItems = [
  _NavItem(
    icon: Icons.explore_outlined,
    activeIcon: Icons.explore_rounded,
    label: 'Explore',
    route: RouteNames.marketplace,
  ),
  _NavItem(
    icon: Icons.smart_toy_outlined,
    activeIcon: Icons.smart_toy_rounded,
    label: 'My Agents',
    route: RouteNames.myAgents,
  ),
  _NavItem(
    icon: Icons.memory_outlined,
    activeIcon: Icons.memory_rounded,
    label: 'Connectors',
    route: RouteNames.profile,
  ),
];

// ── Narrow shell (phone) ────────────────────────────────────────────────────────

class _NarrowShell extends StatelessWidget {
  const _NarrowShell({required this.selectedIndex, required this.child});
  final int selectedIndex;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      key: shellScaffoldKey,
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      drawer: _SideDrawer(selectedIndex: selectedIndex),
      body: child,
    );
  }
}

// ── Wide shell (tablet) ─────────────────────────────────────────────────────────

class _WideShell extends StatelessWidget {
  const _WideShell({required this.selectedIndex, required this.child});
  final int selectedIndex;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: Row(
        children: [
          SizedBox(
            width: 256,
            child: _SideDrawer(selectedIndex: selectedIndex, permanent: true),
          ),
          VerticalDivider(
            width: 1,
            thickness: 1,
            color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

// ── Drawer ──────────────────────────────────────────────────────────────────────

class _SideDrawer extends ConsumerWidget {
  const _SideDrawer({required this.selectedIndex, this.permanent = false});
  final int selectedIndex;
  final bool permanent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF110F0E) : const Color(0xFFFAFAF9);

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _DrawerLogo(isDark: isDark),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 2, 10, 6),
          child: _CreateAgentButton(isDark: isDark),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            children: List.generate(_navItems.length, (i) {
              final item = _navItems[i];
              return _NavTile(
                icon: i == selectedIndex ? item.activeIcon : item.icon,
                label: item.label,
                isActive: i == selectedIndex,
                isDark: isDark,
                onTap: () {
                  if (!permanent) Navigator.of(context).pop();
                  context.go(item.route);
                },
              );
            }),
          ),
        ),
        Expanded(
          child: SidebarThreadList(isDark: isDark, permanent: permanent),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            children: [
              _SecondaryTile(
                icon: Icons.settings_outlined,
                label: 'Settings',
                isDark: isDark,
                onTap: () {
                  if (!permanent) Navigator.of(context).pop();
                  context.go(RouteNames.profile);
                },
              ),
              _SecondaryTile(
                icon: Icons.help_outline_rounded,
                label: 'Help & Docs',
                isDark: isDark,
                onTap: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Divider(
          height: 1,
          color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
        ),
        _UserFooter(isDark: isDark),
      ],
    );

    if (permanent) {
      return Container(
        color: bg,
        child: SafeArea(child: content),
      );
    }

    return Drawer(
      backgroundColor: bg,
      width: 272,
      elevation: 0,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      child: SafeArea(child: content),
    );
  }
}

// ── Drawer logo ─────────────────────────────────────────────────────────────────

class _DrawerLogo extends StatelessWidget {
  const _DrawerLogo({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
      child: Row(
        children: [
          Icon(
            Icons.auto_awesome_rounded,
            size: 18,
            color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
          ),
          const SizedBox(width: 8),
          RichText(
            text: TextSpan(
              style: AppTypography.titleMedium.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.4,
                fontSize: 16,
              ),
              children: [
                const TextSpan(text: 'Persona'),
                TextSpan(
                  text: '.ai',
                  style: TextStyle(
                    color:
                        isDark ? AppColors.primaryDark : AppColors.primaryLight,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Create Agent button ─────────────────────────────────────────────────────────

class _CreateAgentButton extends StatelessWidget {
  const _CreateAgentButton({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ElevatedButton.icon(
        onPressed: () => context.push(RouteNames.agentNew),
        icon: const Icon(Icons.add_rounded, size: 16),
        label: const Text('Create Agent'),
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isDark ? AppColors.primaryDark : AppColors.primaryLight,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          textStyle: AppTypography.labelMedium
              .copyWith(fontWeight: FontWeight.w600, fontSize: 13),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }
}

// ── Nav tile ────────────────────────────────────────────────────────────────────

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.isDark,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool isActive;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final activeColor =
        isDark ? AppColors.primaryDark : AppColors.primaryLight;
    final inactiveTextColor =
        isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
    final inactiveIconColor =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
    final activeBg =
        (isDark ? AppColors.primaryDark : AppColors.primaryLight)
            .withValues(alpha: 0.1);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 1),
      decoration: BoxDecoration(
        color: isActive ? activeBg : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          highlightColor:
              (isDark ? AppColors.inputFillDark : AppColors.inputFillLight)
                  .withValues(alpha: 0.6),
          splashColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 17,
                  color: isActive ? activeColor : inactiveIconColor,
                ),
                const SizedBox(width: 10),
                Text(
                  label,
                  style: AppTypography.bodySmall.copyWith(
                    color: isActive ? activeColor : inactiveTextColor,
                    fontWeight:
                        isActive ? FontWeight.w600 : FontWeight.w500,
                    fontSize: 13.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Secondary tile ──────────────────────────────────────────────────────────────

class _SecondaryTile extends StatelessWidget {
  const _SecondaryTile({
    required this.icon,
    required this.label,
    required this.isDark,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          child: Row(
            children: [
              Icon(
                icon,
                size: 17,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: AppTypography.bodySmall.copyWith(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                  fontWeight: FontWeight.w500,
                  fontSize: 13.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}



// ── User footer ──────────────────────────────────────────────────────────────

class _UserFooter extends StatelessWidget {
  const _UserFooter({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final clerkUser = ClerkAuth.of(context).user;
    final imageUrl = clerkUser?.imageUrl;
    final name = clerkUser?.name.isNotEmpty == true
        ? clerkUser!.name
        : (clerkUser?.firstName ?? 'You');
    final initials = name
        .split(' ')
        .take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
        .join();

    return GestureDetector(
      onTap: () => context.go(RouteNames.profile),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor:
                  isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
              backgroundImage:
                  imageUrl != null ? NetworkImage(imageUrl) : null,
              child: imageUrl == null
                  ? Text(
                      initials.isEmpty ? '?' : initials,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                name,
                style: AppTypography.labelMedium.copyWith(
                  color: isDark
                      ? AppColors.textPrimaryDark
                      : AppColors.textPrimaryLight,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
