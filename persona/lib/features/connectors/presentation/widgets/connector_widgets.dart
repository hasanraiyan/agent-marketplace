import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';

enum ConnectorSection { skills, knowledge, mcps, memory }

extension ConnectorSectionInfo on ConnectorSection {
  String get title => switch (this) {
    ConnectorSection.skills => 'Skills',
    ConnectorSection.knowledge => 'Knowledge Bases',
    ConnectorSection.mcps => 'MCP Servers',
    ConnectorSection.memory => 'AI Memory',
  };

  IconData get icon => switch (this) {
    ConnectorSection.skills => Icons.psychology_rounded,
    ConnectorSection.knowledge => Icons.library_books_rounded,
    ConnectorSection.mcps => Icons.hub_rounded,
    ConnectorSection.memory => Icons.memory_rounded,
  };

  Color get color => switch (this) {
    ConnectorSection.skills => const Color(0xFF9333EA),
    ConnectorSection.knowledge => const Color(0xFF10B981),
    ConnectorSection.mcps => const Color(0xFF0052FF),
    ConnectorSection.memory => const Color(0xFF8B5CF6),
  };

  String get route => switch (this) {
    ConnectorSection.skills => RouteNames.skills,
    ConnectorSection.knowledge => RouteNames.knowledge,
    ConnectorSection.mcps => RouteNames.mcps,
    ConnectorSection.memory => RouteNames.memory,
  };

  String? get newRoute => switch (this) {
    ConnectorSection.skills => RouteNames.skillNew,
    ConnectorSection.knowledge => RouteNames.knowledgeNew,
    ConnectorSection.mcps => RouteNames.mcpNew,
    ConnectorSection.memory => null,
  };
}

class ConnectorPageScaffold extends StatelessWidget {
  const ConnectorPageScaffold({
    super.key,
    required this.title,
    required this.child,
    this.description,
    this.section,
    this.actions = const [],
    this.floatingActionButton,
  });

  final String title;
  final String? description;
  final ConnectorSection? section;
  final List<Widget> actions;
  final Widget child;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isWide = MediaQuery.sizeOf(context).width >= 920;

    final topActions = [
      if (section != null)
        IconButton(
          tooltip: 'All connectors',
          onPressed: () => context.go(RouteNames.connectors),
          icon: const Icon(Icons.apps_rounded),
        ),
      ...actions,
    ];

    final body = section != null && isWide
        ? Row(
            children: [
              _ConnectorRail(section: section!),
              VerticalDivider(
                width: 1,
                color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
              ),
              Expanded(child: child),
            ],
          )
        : child;

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.backgroundDark
          : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(title: title, actions: topActions),
        ),
      ),
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}

class ConnectorScrollableContent extends StatelessWidget {
  const ConnectorScrollableContent({
    super.key,
    required this.children,
    this.maxWidth = 1180,
    this.padding,
    this.physics,
  });

  final List<Widget> children;
  final double maxWidth;
  final EdgeInsetsGeometry? padding;
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    return SingleChildScrollView(
      physics: physics ?? const AlwaysScrollableScrollPhysics(),
      padding:
          padding ??
          EdgeInsets.fromLTRB(r.horizontalPadding, 8, r.horizontalPadding, 96),
      child: ResponsiveCenter(
        maxWidth: maxWidth,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }
}

class ConnectorIntro extends StatelessWidget {
  const ConnectorIntro({
    super.key,
    required this.title,
    required this.description,
    this.trailing,
  });

  final String title;
  final String description;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.headlineSmall.copyWith(
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: AppTypography.bodyMedium.copyWith(
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 16), trailing!],
        ],
      ),
    );
  }
}

class ConnectorSearchField extends StatelessWidget {
  const ConnectorSearchField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onChanged,
    this.onClear,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear search',
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded),
              ),
        filled: true,
        fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class ConnectorBadge extends StatelessWidget {
  const ConnectorBadge({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.badge.copyWith(color: color),
      ),
    );
  }
}

class ConnectorCardFrame extends StatelessWidget {
  const ConnectorCardFrame({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.description,
    required this.footer,
    this.badge,
    this.onTap,
    this.trailing,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String description;
  final Widget footer;
  final Widget? badge;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? AppColors.dividerDark : AppColors.dividerLight;
    final cardColor = isDark ? AppColors.cardDark : AppColors.cardLight;

    return Material(
      color: cardColor,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            border: Border.all(color: borderColor),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: Colors.white, size: 24),
                  ),
                  const Spacer(),
                  ?trailing,
                ],
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.titleMedium.copyWith(
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (badge != null) ...[const SizedBox(width: 8), badge!],
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Text(
                  description.isEmpty
                      ? 'No description provided.'
                      : description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                ),
              ),
              Divider(
                height: 28,
                color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
              ),
              footer,
            ],
          ),
        ),
      ),
    );
  }
}

class ConnectorSkeletonGrid extends StatelessWidget {
  const ConnectorSkeletonGrid({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: r.gridColumns,
        mainAxisSpacing: 14,
        crossAxisSpacing: 14,
        childAspectRatio: r.isPhone ? 1.15 : 1.1,
      ),
      itemBuilder: (context, index) => Container(
        decoration: BoxDecoration(
          color: Theme.of(
            context,
          ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}

class ConnectorGrid extends StatelessWidget {
  const ConnectorGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.minChildHeight = 220,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double minChildHeight;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: r.gridColumns,
        mainAxisSpacing: 14,
        crossAxisSpacing: 14,
        mainAxisExtent: minChildHeight,
      ),
      itemBuilder: itemBuilder,
    );
  }
}

class DetailCard extends StatelessWidget {
  const DetailCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
        ),
      ),
      child: child,
    );
  }
}

class KeyValueRow extends StatelessWidget {
  const KeyValueRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppTypography.labelMedium.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectorRail extends StatelessWidget {
  const _ConnectorRail({required this.section});

  final ConnectorSection section;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      width: 228,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                section.title.toUpperCase(),
                style: AppTypography.labelSmall.copyWith(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              _RailTile(
                icon: Icons.arrow_back_rounded,
                label: 'All Connectors',
                selected: false,
                onTap: () => context.go(RouteNames.connectors),
              ),
              _RailTile(
                icon: section.icon,
                label: section == ConnectorSection.mcps
                    ? 'My Servers'
                    : section == ConnectorSection.memory
                    ? 'Memory Dashboard'
                    : 'My ${section.title}',
                selected: true,
                onTap: () => context.go(section.route),
              ),
              if (section == ConnectorSection.skills)
                _RailTile(
                  icon: Icons.public_rounded,
                  label: 'Public Marketplace',
                  selected:
                      GoRouterState.of(context).matchedLocation ==
                      RouteNames.skillPublic,
                  onTap: () => context.go(RouteNames.skillPublic),
                ),
              if (section.newRoute != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push(section.newRoute!),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(
                    section == ConnectorSection.mcps
                        ? 'Connect Server'
                        : section == ConnectorSection.knowledge
                        ? 'New KB'
                        : 'New Skill',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RailTile extends StatelessWidget {
  const _RailTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final active = isDark ? AppColors.primaryDark : AppColors.primaryLight;
    return Material(
      color: selected ? active.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          child: Row(
            children: [
              Icon(
                icon,
                size: 17,
                color: selected
                    ? active
                    : isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(
                    color: selected
                        ? active
                        : isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
