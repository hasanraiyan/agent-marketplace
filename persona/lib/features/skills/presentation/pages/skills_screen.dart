import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../../data/models/skill_model.dart';
import '../providers/skills_provider.dart';

class SkillsScreen extends ConsumerStatefulWidget {
  const SkillsScreen({super.key});

  @override
  ConsumerState<SkillsScreen> createState() => _SkillsScreenState();
}

class _SkillsScreenState extends ConsumerState<SkillsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(100),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(
            title: 'Skills',
            bottom: TabBar(
              controller: _tabs,
              tabs: const [
                Tab(text: 'My Skills'),
                Tab(text: 'Public'),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.skillNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Skill'),
        backgroundColor: isDark ? AppColors.primaryDark : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _MySkillsTab(r: r, isDark: isDark),
          _PublicSkillsTab(r: r, isDark: isDark),
        ],
      ),
    );
  }
}

// ── My Skills tab ─────────────────────────────────────────────────────────────

class _MySkillsTab extends ConsumerWidget {
  const _MySkillsTab({required this.r, required this.isDark});
  final Responsive r;
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skillsAsync = ref.watch(mySkillsProvider);

    return skillsAsync.when(
      loading: () => ListView.builder(
        itemCount: 4,
        itemBuilder: (_, _) => const ListTileSkeleton(),
      ),
      error: (e, _) => ErrorState(
        message: e.toString(),
        onRetry: () => ref.refresh(mySkillsProvider.future),
      ),
      data: (skills) => _buildSkillList(
        context: context,
        ref: ref,
        skills: skills,
        isDark: isDark,
        r: r,
        readOnly: false,
        onRefresh: () => ref.refresh(mySkillsProvider.future),
      ),
    );
  }
}

// ── Public Skills tab ─────────────────────────────────────────────────────────

class _PublicSkillsTab extends ConsumerWidget {
  const _PublicSkillsTab({required this.r, required this.isDark});
  final Responsive r;
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skillsAsync = ref.watch(publicSkillsProvider);

    return skillsAsync.when(
      loading: () => ListView.builder(
        itemCount: 4,
        itemBuilder: (_, _) => const ListTileSkeleton(),
      ),
      error: (e, _) => ErrorState(
        message: e.toString(),
        onRetry: () => ref.refresh(publicSkillsProvider.future),
      ),
      data: (skills) => _buildSkillList(
        context: context,
        ref: ref,
        skills: skills,
        isDark: isDark,
        r: r,
        readOnly: true,
        onRefresh: () => ref.refresh(publicSkillsProvider.future),
      ),
    );
  }
}

// ── Shared list builder ───────────────────────────────────────────────────────

Widget _buildSkillList({
  required BuildContext context,
  required WidgetRef ref,
  required List<SkillModel> skills,
  required bool isDark,
  required Responsive r,
  required bool readOnly,
  required Future<void> Function() onRefresh,
}) {
  if (skills.isEmpty) {
    return EmptyState(
      icon: Icons.psychology_outlined,
      title: readOnly ? 'No public skills yet' : 'No skills created',
      subtitle: readOnly
          ? 'Public skills from the community will appear here'
          : 'Create reusable skills to attach to your agents',
    );
  }

  return RefreshIndicator(
    onRefresh: onRefresh,
    child: ListView.separated(
      padding: EdgeInsets.symmetric(
          horizontal: r.horizontalPadding, vertical: 8),
      itemCount: skills.length,
      separatorBuilder: (_, _) => Divider(
        height: 1,
        color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
      ),
      itemBuilder: (context, i) {
        final skill = skills[i];
        return ListTile(
          onTap: readOnly
              ? null
              : () => context.push(RouteNames.skillEditPath(skill.id)),
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primaryLight.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.psychology_rounded,
                color: isDark
                    ? AppColors.primaryDark
                    : AppColors.primaryLight),
          ),
          title: Text(skill.name, style: AppTypography.titleSmall),
          subtitle: Text(
            skill.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          trailing:
              readOnly ? null : const Icon(Icons.chevron_right_rounded),
        );
      },
    ),
  );
}
