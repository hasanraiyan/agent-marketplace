import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../data/models/agent_model.dart';

class AgentCard extends StatelessWidget {
  const AgentCard({
    super.key,
    required this.agent,
    this.onTap,
    this.trailing,
  });

  final AgentModel agent;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap ??
          () => context.push(RouteNames.agentDetailPath(agent.id)),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : AppColors.cardLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark
                ? AppColors.dividerDark
                : AppColors.dividerLight,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _AgentAvatar(agent: agent, size: 44),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        agent.name,
                        style: AppTypography.titleSmall.copyWith(
                          color: isDark
                              ? AppColors.textPrimaryDark
                              : AppColors.textPrimaryLight,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      _CategoryChip(category: agent.category),
                    ],
                  ),
                ),
                ?trailing,
              ],
            ),
            if (agent.description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                agent.description,
                style: AppTypography.bodySmall.copyWith(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (agent.tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: agent.tags.take(3).map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.chipBackgroundDark
                          : AppColors.chipBackgroundLight,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      tag,
                      style: AppTypography.labelSmall.copyWith(
                        color: isDark
                            ? AppColors.primaryDark
                            : AppColors.primaryLight,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 12,
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                ),
                const SizedBox(width: 4),
                Text(
                  '${agent.messageCount}',
                  style: AppTypography.labelSmall.copyWith(
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                ),
                const Spacer(),
                _VisibilityIcon(visibility: agent.visibility),
              ],
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 250.ms)
        .slideY(begin: 0.04, end: 0, duration: 250.ms);
  }
}

class _AgentAvatar extends StatelessWidget {
  const _AgentAvatar({required this.agent, required this.size});

  final AgentModel agent;
  final double size;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (agent.avatar.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          agent.avatar,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(isDark),
        ),
      );
    }
    return _fallback(isDark);
  }

  Widget _fallback(bool isDark) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(
        Icons.auto_awesome_rounded,
        size: size * 0.5,
        color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.category});
  final String category;

  @override
  Widget build(BuildContext context) {
    return Text(
      category,
      style: AppTypography.labelSmall.copyWith(
        color: AppColors.textSecondaryLight,
      ),
    );
  }
}

class _VisibilityIcon extends StatelessWidget {
  const _VisibilityIcon({required this.visibility});
  final String visibility;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondaryLight;

    final icon = switch (visibility) {
      'public' => Icons.public_rounded,
      'unlisted' => Icons.link_rounded,
      _ => Icons.lock_outline_rounded,
    };

    return Icon(icon, size: 13, color: color);
  }
}

/// Compact list-tile version of [AgentCard] for My Agents list.
class AgentListTile extends StatelessWidget {
  const AgentListTile({
    super.key,
    required this.agent,
    this.onTap,
    this.onDelete,
  });

  final AgentModel agent;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      onTap: onTap,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: _AgentAvatar(agent: agent, size: 44),
      title: Text(
        agent.name,
        style: AppTypography.titleSmall.copyWith(
          color:
              isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
        ),
      ),
      subtitle: Text(
        agent.description,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.bodySmall.copyWith(
          color: isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _VisibilityBadge(visibility: agent.visibility),
          if (onDelete != null) ...[
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              iconSize: 20,
              color: AppColors.error,
              onPressed: onDelete,
            ),
          ],
        ],
      ),
    );
  }
}

class _VisibilityBadge extends StatelessWidget {
  const _VisibilityBadge({required this.visibility});
  final String visibility;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (visibility) {
      'public' => ('Public', AppColors.success),
      'unlisted' => ('Unlisted', AppColors.warning),
      _ => ('Private', AppColors.textSecondaryLight),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: color),
      ),
    );
  }
}
