import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../providers/skills_provider.dart';

class SkillDetailScreen extends ConsumerWidget {
  const SkillDetailScreen({super.key, required this.skillId});

  final String skillId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skillAsync = ref.watch(skillDetailProvider(skillId));
    final agentsAsync = ref.watch(skillAgentsProvider(skillId));
    final isOwnerFromList = (ref.watch(mySkillsProvider).value ?? []).any(
      (s) => s.id == skillId,
    );

    return ConnectorPageScaffold(
      title: 'Skill Detail',
      section: ConnectorSection.skills,
      child: skillAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(skillDetailProvider(skillId).future),
        ),
        data: (skill) {
          final isOwner = skill.isOwner || isOwnerFromList;
          return ConnectorScrollableContent(
            maxWidth: 980,
            children: [
              ConnectorIntro(
                title: skill.name,
                description: skill.description,
                trailing: isOwner
                    ? Wrap(
                        spacing: 8,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => context.push(
                              RouteNames.skillEditPath(skill.id),
                            ),
                            icon: const Icon(Icons.edit_rounded, size: 18),
                            label: const Text('Edit'),
                          ),
                          FilledButton.icon(
                            onPressed: () => _deleteSkill(
                              context,
                              ref,
                              skill.id,
                              agentsAsync.value ?? const [],
                            ),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.error,
                            ),
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                            ),
                            label: const Text('Delete'),
                          ),
                        ],
                      )
                    : null,
              ),
              DetailCard(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    ConnectorBadge(
                      label: skill.isPublic ? 'Public' : 'Private',
                      color: skill.isPublic
                          ? AppColors.success
                          : AppColors.textSecondaryLight,
                    ),
                    ConnectorBadge(
                      label: isOwner
                          ? 'Owner'
                          : skill.ownerName.isEmpty
                          ? 'Community'
                          : skill.ownerName,
                      color: isOwner
                          ? ConnectorSection.skills.color
                          : AppColors.info,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              DetailCard(
                padding: EdgeInsets.zero,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
                      child: Row(
                        children: [
                          Text(
                            'SKILL.md',
                            style: AppTypography.titleMedium.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const Spacer(),
                          IconButton(
                            tooltip: 'Copy instructions',
                            onPressed: () =>
                                _copyInstructions(context, skill.instructions),
                            icon: const Icon(Icons.copy_rounded),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: MarkdownBody(
                        data: skill.instructions.isEmpty
                            ? '_No instructions saved._'
                            : skill.instructions,
                        selectable: true,
                        styleSheet:
                            MarkdownStyleSheet.fromTheme(
                              Theme.of(context),
                            ).copyWith(
                              code: AppTypography.mono,
                              p: AppTypography.bodyMedium,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _UsedByAgentsCard(agentsAsync: agentsAsync),
              const SizedBox(height: 14),
              DetailCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Details', style: AppTypography.titleMedium),
                    const SizedBox(height: 8),
                    KeyValueRow(label: 'Type', value: 'Skill'),
                    KeyValueRow(
                      label: 'Visibility',
                      value: skill.isPublic ? 'Public' : 'Private',
                    ),
                    KeyValueRow(
                      label: 'Used by',
                      value:
                          '${agentsAsync.value?.length ?? 0} agent${(agentsAsync.value?.length ?? 0) == 1 ? '' : 's'}',
                    ),
                    KeyValueRow(
                      label: 'Created',
                      value: _formatDate(skill.createdAt),
                    ),
                    KeyValueRow(
                      label: 'Updated',
                      value: _formatDate(skill.updatedAt),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _copyInstructions(
    BuildContext context,
    String instructions,
  ) async {
    await Clipboard.setData(ClipboardData(text: instructions));
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('SKILL.md copied')));
    }
  }

  Future<void> _deleteSkill(
    BuildContext context,
    WidgetRef ref,
    String id,
    List<AgentModel> agents,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete skill?'),
        content: Text(
          agents.isEmpty
              ? 'This action cannot be undone.'
              : 'This skill is used by ${agents.length} agent${agents.length == 1 ? '' : 's'} and will be removed from them.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(mySkillsProvider.notifier).delete(id);
      if (context.mounted) context.go(RouteNames.skills);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Unknown';
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }
}

class _UsedByAgentsCard extends StatelessWidget {
  const _UsedByAgentsCard({required this.agentsAsync});

  final AsyncValue<List<AgentModel>> agentsAsync;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Used by Agents', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          agentsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(
              e.toString(),
              style: AppTypography.bodySmall.copyWith(color: AppColors.error),
            ),
            data: (agents) => agents.isEmpty
                ? Text(
                    'No agents are using this skill.',
                    style: AppTypography.bodySmall,
                  )
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: agents
                        .map((agent) => _AgentPill(agent: agent))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _AgentPill extends StatelessWidget {
  const _AgentPill({required this.agent});

  final AgentModel agent;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.smart_toy_outlined, size: 16),
          const SizedBox(width: 6),
          Text(agent.name, style: AppTypography.labelMedium),
        ],
      ),
    );
  }
}
