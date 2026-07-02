import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../providers/agent_provider.dart';
import '../widgets/agent_card.dart';

class MyAgentsScreen extends ConsumerWidget {
  const MyAgentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final agentsAsync = ref.watch(myAgentsProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            AppTopBar(
              title: 'My Agents',
              actions: [
                FilledButton.icon(
                  onPressed: () => context.push(RouteNames.agentNew),
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text('Create'),
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        isDark ? AppColors.primaryDark : AppColors.primaryLight,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 0),
                    minimumSize: const Size(0, 36),
                  ),
                ),
              ],
            ),
            Expanded(
              child: agentsAsync.when(
                loading: () => ListView.builder(
                  itemCount: 6,
                  itemBuilder: (_, _) => const ListTileSkeleton(),
                ),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.refresh(myAgentsProvider.future),
                ),
                data: (agents) => agents.isEmpty
                    ? EmptyState(
                        icon: Icons.auto_awesome_outlined,
                        title: "You haven't built any agents yet",
                        subtitle:
                            'Create your first agent to power your workflows',
                        action: FilledButton.icon(
                          onPressed: () => context.push(RouteNames.agentNew),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Create Agent'),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => ref.refresh(myAgentsProvider.future),
                        child: ListView.separated(
                          padding: EdgeInsets.symmetric(
                            horizontal: r.horizontalPadding,
                            vertical: 8,
                          ),
                          itemCount: agents.length,
                          separatorBuilder: (_, _) => Divider(
                            height: 1,
                            color: isDark
                                ? AppColors.dividerDark
                                : AppColors.dividerLight,
                          ),
                          itemBuilder: (context, i) {
                            final agent = agents[i];
                            return Dismissible(
                              key: Key(agent.id),
                              direction: DismissDirection.endToStart,
                              background: Container(
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                color: AppColors.error,
                                child: const Icon(Icons.delete_rounded,
                                    color: Colors.white),
                              ),
                              confirmDismiss: (_) async {
                                return await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Delete agent?'),
                                    content: Text(
                                        'Delete "${agent.name}"? This cannot be undone.'),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      FilledButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, true),
                                        style: FilledButton.styleFrom(
                                            backgroundColor: AppColors.error),
                                        child: const Text('Delete'),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              onDismissed: (_) {
                                ref
                                    .read(myAgentsProvider.notifier)
                                    .delete(agent.id);
                              },
                              child: AgentListTile(
                                agent: agent,
                                onTap: () => context.push(
                                  RouteNames.agentDetailPath(agent.id),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
