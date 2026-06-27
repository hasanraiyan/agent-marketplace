import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../knowledge/presentation/providers/knowledge_provider.dart';
import '../../../mcp_servers/presentation/providers/mcp_provider.dart';
import '../../../memory/presentation/providers/memory_provider.dart';
import '../../../skills/presentation/providers/skills_provider.dart';
import '../widgets/connector_widgets.dart';

class ConnectorsHubScreen extends ConsumerWidget {
  const ConnectorsHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skills = ref.watch(mySkillsProvider);
    final knowledge = ref.watch(knowledgeListProvider);
    final mcps = ref.watch(mcpListProvider);
    final memory = ref.watch(memoryProvider);

    final cards = [
      _HubCardData(
        title: 'Skills',
        badge: 'CORE',
        description:
            'Create specialized instructions and capabilities that teach your agents new behaviors.',
        icon: Icons.psychology_rounded,
        footerIcon: Icons.description_rounded,
        color: const Color(0xFF9333EA),
        route: RouteNames.skills,
        count: skills.value?.length,
        loading: skills.isLoading,
      ),
      _HubCardData(
        title: 'Knowledge Bases',
        badge: 'RAG',
        description:
            'Upload documents and let your agents search them with semantic retrieval.',
        icon: Icons.library_books_rounded,
        footerIcon: Icons.storage_rounded,
        color: const Color(0xFF10B981),
        route: RouteNames.knowledge,
        count: knowledge.value?.length,
        loading: knowledge.isLoading,
      ),
      _HubCardData(
        title: 'MCP Servers',
        badge: 'PROTOCOL',
        description:
            'Connect agents to external APIs, tools, and data through remote protocol servers.',
        icon: Icons.hub_rounded,
        footerIcon: Icons.dns_rounded,
        color: const Color(0xFF0052FF),
        route: RouteNames.mcps,
        count: mcps.value?.length,
        loading: mcps.isLoading,
      ),
      _HubCardData(
        title: 'AI Memory',
        badge: 'MEMORY',
        description:
            'View and manage user profile preferences and long-term agent memories.',
        icon: Icons.memory_rounded,
        footerIcon: Icons.memory_rounded,
        color: const Color(0xFF8B5CF6),
        route: RouteNames.memory,
        count: memory.value?.totalCount,
        loading: memory.isLoading,
      ),
    ];

    return ConnectorPageScaffold(
      title: 'Connectors',
      child: ConnectorScrollableContent(
        children: [
          const ConnectorIntro(
            title: 'Connectors',
            description:
                'Choose a connector type to manage and extend your agents.',
          ),
          ConnectorGrid(
            itemCount: cards.length,
            minChildHeight: 260,
            itemBuilder: (context, index) {
              final card = cards[index];
              return ConnectorCardFrame(
                icon: card.icon,
                color: card.color,
                title: card.title,
                description: card.description,
                badge: ConnectorBadge(label: card.badge, color: card.color),
                onTap: () => context.go(card.route),
                footer: _HubFooter(card: card),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _HubFooter extends StatelessWidget {
  const _HubFooter({required this.card});

  final _HubCardData card;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final count = card.count ?? 0;
    return Row(
      children: [
        Icon(
          card.footerIcon,
          size: 16,
          color: isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight,
        ),
        const SizedBox(width: 8),
        if (card.loading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: card.color),
          )
        else
          Text(
            '$count ${count == 1 ? 'item' : 'items'}',
            style: AppTypography.labelMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
        const Spacer(),
        Text(
          'Manage',
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
    );
  }
}

class _HubCardData {
  const _HubCardData({
    required this.title,
    required this.badge,
    required this.description,
    required this.icon,
    required this.footerIcon,
    required this.color,
    required this.route,
    required this.count,
    required this.loading,
  });

  final String title;
  final String badge;
  final String description;
  final IconData icon;
  final IconData footerIcon;
  final Color color;
  final String route;
  final int? count;
  final bool loading;
}
