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

class PublicSkillsScreen extends ConsumerStatefulWidget {
  const PublicSkillsScreen({super.key});

  @override
  ConsumerState<PublicSkillsScreen> createState() => _PublicSkillsScreenState();
}

class _PublicSkillsScreenState extends ConsumerState<PublicSkillsScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final skillsAsync = ref.watch(publicSkillsProvider);
    return ConnectorPageScaffold(
      title: 'Public Skills',
      section: ConnectorSection.skills,
      child: skillsAsync.when(
        loading: () => const ConnectorScrollableContent(
          children: [
            ConnectorIntro(
              title: 'Public Marketplace',
              description:
                  'Browse community skills and inspect their SKILL.md instructions.',
            ),
            ConnectorSkeletonGrid(),
          ],
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(publicSkillsProvider.future),
        ),
        data: (skills) => RefreshIndicator(
          onRefresh: () => ref.refresh(publicSkillsProvider.future),
          child: _PublicSkillList(
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

class _PublicSkillList extends StatelessWidget {
  const _PublicSkillList({
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
            final author = skill.ownerName.isEmpty
                ? 'Community'
                : skill.ownerName;
            final haystack = '${skill.name} ${skill.description} $author'
                .toLowerCase();
            return haystack.contains(normalized);
          }).toList();

    return ConnectorScrollableContent(
      children: [
        const ConnectorIntro(
          title: 'Public Marketplace',
          description:
              'Browse community skills and inspect their SKILL.md instructions.',
        ),
        if (skills.isNotEmpty) ...[
          ConnectorSearchField(
            controller: searchCtrl,
            hintText: 'Search public skills',
            onChanged: onQueryChanged,
            onClear: onClearSearch,
          ),
          const SizedBox(height: 16),
        ],
        if (skills.isEmpty)
          const EmptyState(
            icon: Icons.public_off_rounded,
            title: 'No public skills yet',
            subtitle: 'Community skills will appear here when published.',
          )
        else if (filtered.isEmpty)
          EmptyState(
            icon: Icons.search_rounded,
            title: 'No matching public skills',
            subtitle: 'Try a different name, description, or author.',
            action: FilledButton.tonal(
              onPressed: onClearSearch,
              child: const Text('Clear search'),
            ),
          )
        else
          ConnectorGrid(
            itemCount: filtered.length,
            itemBuilder: (context, index) =>
                _PublicSkillCard(skill: filtered[index]),
          ),
      ],
    );
  }
}

class _PublicSkillCard extends StatelessWidget {
  const _PublicSkillCard({required this.skill});

  final SkillModel skill;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final author = skill.ownerName.isEmpty ? 'Community' : skill.ownerName;
    return ConnectorCardFrame(
      icon: Icons.psychology_rounded,
      color: ConnectorSection.skills.color,
      title: skill.name,
      description: skill.description,
      badge: const ConnectorBadge(label: 'Public', color: AppColors.success),
      onTap: () => context.push(RouteNames.skillDetailPath(skill.id)),
      footer: Row(
        children: [
          Icon(
            Icons.person_outline_rounded,
            size: 16,
            color: isDark
                ? AppColors.textSecondaryDark
                : AppColors.textSecondaryLight,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              author,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelMedium.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ),
          Text(
            'View',
            style: AppTypography.labelMedium.copyWith(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
