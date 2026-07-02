import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/skill_model.dart';
import '../providers/skills_provider.dart';

class SkillsScreen extends ConsumerStatefulWidget {
  const SkillsScreen({super.key});

  @override
  ConsumerState<SkillsScreen> createState() => _SkillsScreenState();
}

class _SkillsScreenState extends ConsumerState<SkillsScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final skillsAsync = ref.watch(mySkillsProvider);

    return ConnectorPageScaffold(
      title: 'Skills',
      section: ConnectorSection.skills,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.skillNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Skill'),
        backgroundColor: isDark
            ? AppColors.primaryDark
            : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      child: skillsAsync.when(
        loading: () => const ConnectorScrollableContent(
          children: [
            ConnectorIntro(
              title: 'My Skills',
              description:
                  'Create reusable SKILL.md instructions and attach them to agents.',
            ),
            ConnectorSkeletonGrid(),
          ],
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(mySkillsProvider.future),
        ),
        data: (skills) => RefreshIndicator(
          onRefresh: () => ref.refresh(mySkillsProvider.future),
          child: _SkillListContent(
            skills: skills,
            query: _query,
            searchCtrl: _searchCtrl,
            onQueryChanged: (value) => setState(() => _query = value),
            onClearSearch: () {
              _searchCtrl.clear();
              setState(() => _query = '');
            },
          ),
        ),
      ),
    );
  }
}

class _SkillListContent extends StatelessWidget {
  const _SkillListContent({
    required this.skills,
    required this.query,
    required this.searchCtrl,
    required this.onQueryChanged,
    required this.onClearSearch,
  });

  final List<SkillModel> skills;
  final String query;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final filtered = normalized.isEmpty
        ? skills
        : skills.where((skill) {
            final haystack =
                '${skill.name} ${skill.description} ${skill.instructions}'
                    .toLowerCase();
            return haystack.contains(normalized);
          }).toList();

    return ConnectorScrollableContent(
      children: [
        ConnectorIntro(
          title: 'My Skills',
          description:
              'Create reusable SKILL.md instructions and attach them to agents.',
          trailing: FilledButton.icon(
            onPressed: () => context.push(RouteNames.skillPublic),
            icon: const Icon(Icons.public_rounded, size: 18),
            label: const Text('Marketplace'),
          ),
        ),
        if (skills.isNotEmpty) ...[
          ConnectorSearchField(
            controller: searchCtrl,
            hintText: 'Search skills',
            onChanged: onQueryChanged,
            onClear: onClearSearch,
          ),
          const SizedBox(height: 16),
        ],
        if (skills.isEmpty)
          EmptyState(
            icon: Icons.psychology_outlined,
            title: 'No skills created',
            subtitle:
                'Create a reusable skill to teach your agents a workflow.',
            action: FilledButton.icon(
              onPressed: () => context.push(RouteNames.skillNew),
              icon: const Icon(Icons.add_rounded),
              label: const Text('New Skill'),
            ),
          )
        else if (filtered.isEmpty)
          EmptyState(
            icon: Icons.search_rounded,
            title: 'No matching skills',
            subtitle: 'Try a different name, description, or instruction.',
            action: FilledButton.tonal(
              onPressed: onClearSearch,
              child: const Text('Clear search'),
            ),
          )
        else
          ConnectorGrid(
            itemCount: filtered.length,
            itemBuilder: (context, index) => _SkillCard(skill: filtered[index]),
          ),
      ],
    );
  }
}

class _SkillCard extends StatelessWidget {
  const _SkillCard({required this.skill});

  final SkillModel skill;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final visibilityColor = skill.isPublic
        ? AppColors.success
        : AppColors.textSecondaryLight;
    return ConnectorCardFrame(
      icon: Icons.psychology_rounded,
      color: ConnectorSection.skills.color,
      title: skill.name,
      description: skill.description,
      badge: ConnectorBadge(
        label: skill.isPublic ? 'Public' : 'Private',
        color: visibilityColor,
      ),
      onTap: () => context.push(RouteNames.skillDetailPath(skill.id)),
      footer: Row(
        children: [
          Icon(
            Icons.description_rounded,
            size: 16,
            color: isDark
                ? AppColors.textSecondaryDark
                : AppColors.textSecondaryLight,
          ),
          const SizedBox(width: 6),
          Text(
            'SKILL.md',
            style: AppTypography.labelMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const Spacer(),
          Text(
            'Details',
            style: AppTypography.labelMedium.copyWith(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 4),
          Icon(
            Icons.arrow_forward_rounded,
            size: 16,
            color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
          ),
        ],
      ),
    );
  }
}
