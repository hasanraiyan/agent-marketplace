import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../providers/profile_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: AppTopBar(title: 'Profile'),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                  horizontal: r.horizontalPadding, vertical: 16),
              child: ResponsiveCenter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [

                // Avatar + name block
                profileAsync.when(
                  loading: () => const _ProfileHeaderSkeleton(),
                  error: (_, _) => const SizedBox.shrink(),
                  data: (user) => _ProfileHeader(isDark: isDark, name: user?.name ?? ''),
                ),
                const SizedBox(height: 32),

                // Settings navigation
                _SectionLabel(isDark: isDark, label: 'Configuration'),
                const SizedBox(height: 8),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.key_rounded,
                  label: 'LLM Providers',
                  subtitle: 'OpenAI, Anthropic, Google…',
                  onTap: () => context.push(RouteNames.providers),
                ),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.hub_rounded,
                  label: 'MCP Servers',
                  subtitle: 'Model Context Protocol',
                  onTap: () => context.push(RouteNames.mcps),
                ),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.psychology_rounded,
                  label: 'Skills',
                  subtitle: 'Custom agent capabilities',
                  onTap: () => context.push(RouteNames.skills),
                ),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.library_books_rounded,
                  label: 'Knowledge Bases',
                  subtitle: 'Documents for RAG',
                  onTap: () => context.push(RouteNames.knowledge),
                ),
                const SizedBox(height: 24),

                _SectionLabel(isDark: isDark, label: 'Account'),
                const SizedBox(height: 8),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.logout_rounded,
                  label: 'Sign Out',
                  iconColor: AppColors.error,
                  textColor: AppColors.error,
                  onTap: () async {
                    final authState = ClerkAuth.of(context);
                    await authState.signOut();
                  },
                ),
                _NavTile(
                  isDark: isDark,
                  icon: Icons.delete_forever_rounded,
                  label: 'Delete Account',
                  subtitle: 'Permanently remove your account',
                  iconColor: AppColors.error,
                  textColor: AppColors.error,
                  onTap: () => _confirmDelete(context, ref),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    ],
  ),
      );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This will permanently delete your account and all associated data. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Delete Forever'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await ref.read(profileDatasourceProvider).deleteProfile();
      if (context.mounted) {
        final authState = ClerkAuth.of(context);
        await authState.signOut();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.isDark, required this.name});
  final bool isDark;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.primaryLight.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(
            Icons.person_rounded,
            size: 32,
            color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
          ),
        ),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              name.isNotEmpty ? name : 'User',
              style: AppTypography.titleLarge.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Persona.ai member',
              style: AppTypography.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ProfileHeaderSkeleton extends StatelessWidget {
  const _ProfileHeaderSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        SkeletonBox(width: 64, height: 64, borderRadius: 16),
        SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(width: 140, height: 20),
            SizedBox(height: 6),
            SkeletonBox(width: 100, height: 14),
          ],
        ),
      ],
    );
  }
}

// ignore: must_be_immutable
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 8,
  });
  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? Colors.white.withValues(alpha: 0.07)
            : Colors.black.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.isDark, required this.label});
  final bool isDark;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: AppTypography.labelSmall.copyWith(
        color: isDark
            ? AppColors.textSecondaryDark
            : AppColors.textSecondaryLight,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.isDark,
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.iconColor,
    this.textColor,
  });

  final bool isDark;
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    final effectiveTextColor = textColor ??
        (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight);
    final effectiveIconColor = iconColor ??
        (isDark ? AppColors.primaryDark : AppColors.primaryLight);

    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(vertical: 2),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: effectiveIconColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icon, size: 20, color: effectiveIconColor),
      ),
      title: Text(
        label,
        style: AppTypography.bodyMedium.copyWith(
          color: effectiveTextColor,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: AppTypography.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            )
          : null,
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark
            ? AppColors.textSecondaryDark
            : AppColors.textSecondaryLight,
      ),
    );
  }
}
