import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../../../chat_thread/presentation/providers/thread_provider.dart';
import '../../data/models/agent_model.dart';
import '../providers/agent_provider.dart';

class AgentDetailScreen extends ConsumerWidget {
  const AgentDetailScreen({super.key, required this.agentId});

  final String agentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agentAsync = ref.watch(agentDetailProvider(agentId));

    return agentAsync.when(
      loading: () => const _LoadingSkeleton(),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorState(message: e.toString()),
      ),
      data: (agent) => _AgentDetailContent(agent: agent),
    );
  }
}

class _AgentDetailContent extends ConsumerStatefulWidget {
  const _AgentDetailContent({required this.agent});
  final AgentModel agent;

  @override
  ConsumerState<_AgentDetailContent> createState() =>
      _AgentDetailContentState();
}

class _AgentDetailContentState
    extends ConsumerState<_AgentDetailContent> {
  bool _descExpanded = false;
  bool _promptExpanded = false;
  bool _isCreatingThread = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final agent = widget.agent;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 600;

          if (isWide) {
            return _buildWideLayout(context, isDark, r, agent);
          }
          return _buildNarrowLayout(context, isDark, r, agent);
        },
      ),
    );
  }

  Widget _buildNarrowLayout(
      BuildContext context, bool isDark, Responsive r, AgentModel agent) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 200,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: _buildHeroBanner(isDark, agent),
          ),
          actions: [
            if (agent.visibility != 'private')
              IconButton(
                icon: const Icon(Icons.ios_share_rounded),
                onPressed: () {},
              ),
          ],
        ),
        SliverPadding(
          padding: EdgeInsets.all(r.horizontalPadding),
          sliver: SliverList(
            delegate: SliverChildListDelegate(
              _buildDetailContent(context, isDark, agent),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
                r.horizontalPadding, 0, r.horizontalPadding, 32),
            child: _buildStartChatButton(context, isDark, agent),
          ),
        ),
      ],
    );
  }

  Widget _buildWideLayout(
      BuildContext context, bool isDark, Responsive r, AgentModel agent) {
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.all(r.horizontalPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      ..._buildDetailContent(context, isDark, agent),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.all(r.horizontalPadding),
                child: _buildStartChatButton(context, isDark, agent),
              ),
            ],
          ),
        ),
        const VerticalDivider(width: 1),
        Expanded(
          flex: 3,
          child: Stack(
            children: [
              _buildHeroBanner(isDark, agent),
              Positioned(
                top: 16,
                left: 8,
                child: BackButton(
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.all(
                        Colors.black.withValues(alpha: 0.3)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeroBanner(bool isDark, AgentModel agent) {
    final color =
        isDark ? AppColors.primaryDark : AppColors.primaryLight;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.15), color.withValues(alpha: 0.05)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildAvatar(agent, isDark, 80),
            const SizedBox(height: 12),
            Text(
              agent.name,
              style: AppTypography.headlineSmall.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar(AgentModel agent, bool isDark, double size) {
    if (agent.avatar.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.25),
        child: Image.network(
          agent.avatar,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallbackAvatar(isDark, size),
        ),
      );
    }
    return _fallbackAvatar(isDark, size);
  }

  Widget _fallbackAvatar(bool isDark, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Icon(
        Icons.auto_awesome_rounded,
        size: size * 0.5,
        color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
      ),
    );
  }

  List<Widget> _buildDetailContent(
      BuildContext context, bool isDark, AgentModel agent) {
    final textColor = isDark
        ? AppColors.textPrimaryDark
        : AppColors.textPrimaryLight;
    final secondaryColor = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondaryLight;

    return [
      // Category + tags
      Wrap(
        spacing: 8,
        runSpacing: 6,
        children: [
          _Chip(label: agent.category, isDark: isDark, isPrimary: true),
          ...agent.tags
              .map((t) => _Chip(label: t, isDark: isDark, isPrimary: false)),
        ],
      ),
      const SizedBox(height: 16),

      // Description
      if (agent.description.isNotEmpty) ...[
        Text('Description',
            style: AppTypography.titleSmall.copyWith(color: textColor)),
        const SizedBox(height: 6),
        Text(
          agent.description,
          style: AppTypography.bodyMedium.copyWith(color: secondaryColor),
          maxLines: _descExpanded ? null : 4,
          overflow:
              _descExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
        ),
        if (agent.description.length > 200)
          TextButton(
            onPressed: () =>
                setState(() => _descExpanded = !_descExpanded),
            child: Text(_descExpanded ? 'Show less' : 'Read more'),
          ),
        const SizedBox(height: 16),
      ],

      // Intelligence section
      _SectionCard(
        isDark: isDark,
        title: 'Intelligence',
        children: [
          _InfoRow(
              isDark: isDark,
              label: 'Model',
              value: agent.modelName.isNotEmpty
                  ? agent.modelName
                  : 'Default'),
          if (agent.webSearchEnabled)
            _InfoRow(
                isDark: isDark,
                label: 'Web Search',
                value: 'Enabled',
                valueColor: AppColors.success),
        ],
      ),
      const SizedBox(height: 12),

      // System prompt
      if (agent.systemPrompt.isNotEmpty) ...[
        _SectionCard(
          isDark: isDark,
          title: 'System Prompt',
          trailing: IconButton(
            icon: Icon(
              _promptExpanded
                  ? Icons.expand_less_rounded
                  : Icons.expand_more_rounded,
              size: 20,
            ),
            onPressed: () =>
                setState(() => _promptExpanded = !_promptExpanded),
          ),
          children: _promptExpanded
              ? [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.inputFillDark
                          : AppColors.inputFillLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      agent.systemPrompt,
                      style: AppTypography.mono.copyWith(fontSize: 12),
                    ),
                  ),
                ]
              : [
                  Text(
                    agent.systemPrompt,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.mono.copyWith(
                      fontSize: 12,
                      color: secondaryColor,
                    ),
                  ),
                ],
        ),
        const SizedBox(height: 12),
      ],

      // Capabilities
      if (agent.skills.isNotEmpty ||
          agent.mcps.isNotEmpty ||
          agent.knowledgeBases.isNotEmpty) ...[
        _SectionCard(
          isDark: isDark,
          title: 'Capabilities',
          children: [
            if (agent.skills.isNotEmpty)
              _InfoRow(
                  isDark: isDark,
                  label: 'Skills',
                  value: '${agent.skills.length}'),
            if (agent.mcps.isNotEmpty)
              _InfoRow(
                  isDark: isDark,
                  label: 'MCP Servers',
                  value: '${agent.mcps.length}'),
            if (agent.knowledgeBases.isNotEmpty)
              _InfoRow(
                  isDark: isDark,
                  label: 'Knowledge Bases',
                  value: '${agent.knowledgeBases.length}'),
          ],
        ),
        const SizedBox(height: 12),
      ],

      const SizedBox(height: 8),
    ];
  }

  Widget _buildStartChatButton(
      BuildContext context, bool isDark, AgentModel agent) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton.icon(
        onPressed: _isCreatingThread
            ? null
            : () => _startChat(context, agent),
        icon: _isCreatingThread
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.chat_rounded),
        label: Text(
          _isCreatingThread ? 'Starting…' : 'Start Chat',
          style: AppTypography.labelLarge,
        ),
        style: FilledButton.styleFrom(
          backgroundColor:
              isDark ? AppColors.primaryDark : AppColors.primaryLight,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  Future<void> _startChat(BuildContext context, AgentModel agent) async {
    setState(() => _isCreatingThread = true);
    try {
      final thread = await ref
          .read(threadListProvider.notifier)
          .createThread(agentId: agent.id);
      if (context.mounted) {
        context.push(
          RouteNames.chatPath(thread.id),
          extra: {'agentId': agent.id},
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not start chat: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isCreatingThread = false);
    }
  }
}

// ── Supporting widgets ────────────────────────────────────────────────────────

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.isDark,
    required this.isPrimary,
  });

  final String label;
  final bool isDark;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    final bg = isPrimary
        ? (isDark ? AppColors.primaryDark : AppColors.primaryLight)
            .withValues(alpha: 0.12)
        : (isDark ? AppColors.chipBackgroundDark : AppColors.chipBackgroundLight);

    final fg = isPrimary
        ? (isDark ? AppColors.primaryDark : AppColors.primaryLight)
        : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: AppTypography.labelSmall.copyWith(color: fg)),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.isDark,
    required this.title,
    required this.children,
    this.trailing,
  });

  final bool isDark;
  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                title,
                style: AppTypography.titleSmall.copyWith(
                  color: isDark
                      ? AppColors.textPrimaryDark
                      : AppColors.textPrimaryLight,
                ),
              ),
              const Spacer(),
              ?trailing,
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.isDark,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final bool isDark;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(
            label,
            style: AppTypography.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: AppTypography.labelSmall.copyWith(
              color: valueColor ??
                  (isDark
                      ? AppColors.textPrimaryDark
                      : AppColors.textPrimaryLight),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            SkeletonBox(height: 200, borderRadius: 16),
            SizedBox(height: 16),
            SkeletonBox(height: 24),
            SizedBox(height: 12),
            SkeletonBox(height: 80),
            SizedBox(height: 12),
            SkeletonBox(height: 120),
          ],
        ),
      ),
    );
  }
}
