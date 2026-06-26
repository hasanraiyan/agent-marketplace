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
import '../providers/provider_notifier.dart';

class ProvidersScreen extends ConsumerWidget {
  const ProvidersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final providersAsync = ref.watch(providerListProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(title: 'LLM Providers'),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.providerNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Provider'),
        backgroundColor: isDark ? AppColors.primaryDark : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      body: providersAsync.when(
        loading: () => ListView.builder(
          itemCount: 4,
          itemBuilder: (_, _) => const ListTileSkeleton(),
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(providerListProvider.future),
        ),
        data: (providers) => providers.isEmpty
            ? const EmptyState(
                icon: Icons.key_rounded,
                title: 'No providers configured',
                subtitle: 'Add an LLM provider to start creating agents',
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(providerListProvider.future),
                child: ListView.separated(
                  padding: EdgeInsets.symmetric(
                      horizontal: r.horizontalPadding, vertical: 8),
                  itemCount: providers.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: isDark
                        ? AppColors.dividerDark
                        : AppColors.dividerLight,
                  ),
                  itemBuilder: (context, i) {
                    final p = providers[i];
                    return ListTile(
                      onTap: () => context.push(
                          RouteNames.providerEditPath(p.id)),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.key_rounded,
                          color: isDark
                              ? AppColors.primaryDark
                              : AppColors.primaryLight,
                        ),
                      ),
                      title: Row(
                        children: [
                          Text(p.label, style: AppTypography.titleSmall),
                          if (p.isDefault) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'Default',
                                style: AppTypography.labelSmall
                                    .copyWith(color: AppColors.success),
                              ),
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        '${p.baseURL} · ${p.defaultModel}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.bodySmall.copyWith(
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
