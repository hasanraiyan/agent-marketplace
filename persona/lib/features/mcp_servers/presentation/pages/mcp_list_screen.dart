import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../providers/mcp_provider.dart';

class McpListScreen extends ConsumerWidget {
  const McpListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final mcpsAsync = ref.watch(mcpListProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: const Text('MCP Servers'),
        backgroundColor:
            isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        surfaceTintColor: Colors.transparent,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.mcpNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Server'),
        backgroundColor: isDark ? AppColors.primaryDark : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      body: mcpsAsync.when(
        loading: () => ListView.builder(
          itemCount: 4,
          itemBuilder: (_, _) => const ListTileSkeleton(),
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(mcpListProvider.future),
        ),
        data: (mcps) => mcps.isEmpty
            ? const EmptyState(
                icon: Icons.hub_outlined,
                title: 'No MCP servers',
                subtitle:
                    'Add a Model Context Protocol server to extend agent capabilities',
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(mcpListProvider.future),
                child: ListView.separated(
                  padding: EdgeInsets.symmetric(
                      horizontal: r.horizontalPadding, vertical: 8),
                  itemCount: mcps.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: isDark
                        ? AppColors.dividerDark
                        : AppColors.dividerLight,
                  ),
                  itemBuilder: (context, i) {
                    final mcp = mcps[i];
                    return ListTile(
                      onTap: () => context.push(RouteNames.mcpEditPath(mcp.id)),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.hub_rounded,
                            color: isDark
                                ? AppColors.primaryDark
                                : AppColors.primaryLight),
                      ),
                      title: Text(mcp.name, style: AppTypography.titleSmall),
                      subtitle: Text(
                        mcp.serverUrl,
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
                          _AuthBadge(authType: mcp.authType),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right_rounded),
                        ],
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class _AuthBadge extends StatelessWidget {
  const _AuthBadge({required this.authType});
  final String authType;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (authType) {
      'apiKey' => ('API Key', AppColors.info),
      'oauth' => ('OAuth', AppColors.success),
      _ => ('None', AppColors.textSecondaryLight),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: AppTypography.labelSmall.copyWith(color: color)),
    );
  }
}
