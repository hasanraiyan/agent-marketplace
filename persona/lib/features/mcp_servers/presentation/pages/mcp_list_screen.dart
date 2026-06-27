import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/mcp_model.dart';
import '../providers/mcp_provider.dart';

class McpListScreen extends ConsumerStatefulWidget {
  const McpListScreen({super.key});

  @override
  ConsumerState<McpListScreen> createState() => _McpListScreenState();
}

class _McpListScreenState extends ConsumerState<McpListScreen> {
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
    final mcpsAsync = ref.watch(mcpListProvider);

    return ConnectorPageScaffold(
      title: 'MCP Servers',
      section: ConnectorSection.mcps,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.mcpNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Server'),
        backgroundColor: isDark
            ? AppColors.primaryDark
            : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      child: mcpsAsync.when(
        loading: () => const ConnectorScrollableContent(
          children: [
            ConnectorIntro(
              title: 'MCP Servers',
              description:
                  'Manage remote protocol servers that expose tools and resources.',
            ),
            ConnectorSkeletonGrid(),
          ],
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(mcpListProvider.future),
        ),
        data: (mcps) => RefreshIndicator(
          onRefresh: () => ref.refresh(mcpListProvider.future),
          child: _McpListContent(
            mcps: mcps,
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

class _McpListContent extends StatelessWidget {
  const _McpListContent({
    required this.mcps,
    required this.query,
    required this.searchCtrl,
    required this.onQueryChanged,
    required this.onClearSearch,
  });

  final List<McpModel> mcps;
  final String query;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final filtered = normalized.isEmpty
        ? mcps
        : mcps.where((mcp) {
            final haystack =
                '${mcp.name} ${mcp.description} ${mcp.url} ${mcp.authType}'
                    .toLowerCase();
            return haystack.contains(normalized);
          }).toList();

    return ConnectorScrollableContent(
      children: [
        const ConnectorIntro(
          title: 'MCP Servers',
          description:
              'Manage remote protocol servers that expose tools and resources.',
        ),
        if (mcps.isNotEmpty) ...[
          ConnectorSearchField(
            controller: searchCtrl,
            hintText: 'Search servers',
            onChanged: onQueryChanged,
            onClear: onClearSearch,
          ),
          const SizedBox(height: 16),
        ],
        if (mcps.isEmpty)
          EmptyState(
            icon: Icons.hub_outlined,
            title: 'No MCP servers',
            subtitle:
                'Connect a Model Context Protocol server to extend agent capabilities.',
            action: FilledButton.icon(
              onPressed: () => context.push(RouteNames.mcpNew),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Server'),
            ),
          )
        else if (filtered.isEmpty)
          EmptyState(
            icon: Icons.search_rounded,
            title: 'No matching servers',
            subtitle: 'Try a different name, URL, or auth type.',
            action: FilledButton.tonal(
              onPressed: onClearSearch,
              child: const Text('Clear search'),
            ),
          )
        else
          ConnectorGrid(
            itemCount: filtered.length,
            itemBuilder: (context, index) => _McpCard(mcp: filtered[index]),
          ),
      ],
    );
  }
}

class _McpCard extends StatelessWidget {
  const _McpCard({required this.mcp});

  final McpModel mcp;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = mcp.isEnabled
        ? AppColors.success
        : AppColors.textSecondaryLight;
    final toolCount = mcp.tools.length;
    final resourceCount = mcp.resources.length + mcp.resourceTemplates.length;

    return ConnectorCardFrame(
      icon: Icons.hub_rounded,
      color: ConnectorSection.mcps.color,
      title: mcp.name,
      description: mcp.description.isEmpty ? mcp.url : mcp.description,
      badge: ConnectorBadge(
        label: mcp.isEnabled ? 'Enabled' : 'Disabled',
        color: statusColor,
      ),
      onTap: () => context.push(RouteNames.mcpDetailPath(mcp.id)),
      footer: Row(
        children: [
          ConnectorBadge(
            label: mcp.transport.toUpperCase(),
            color: ConnectorSection.mcps.color,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$toolCount tools / $resourceCount resources',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelMedium.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
