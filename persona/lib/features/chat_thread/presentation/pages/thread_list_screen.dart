import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../../data/models/thread_model.dart';
import '../providers/thread_provider.dart';

class ThreadListScreen extends ConsumerWidget {
  const ThreadListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final threadsAsync = ref.watch(threadListProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark, r, ref, threadsAsync),
            Expanded(
              child: threadsAsync.when(
                loading: () => ListView.builder(
                  itemCount: 8,
                  itemBuilder: (_, _) => const ListTileSkeleton(),
                ),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.refresh(threadListProvider.future),
                ),
                data: (threads) => threads.isEmpty
                    ? EmptyState(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'No chats yet',
                        subtitle:
                            'Find an agent in the Marketplace to start a conversation',
                        action: FilledButton.icon(
                          onPressed: () => context.go(RouteNames.marketplace),
                          icon: const Icon(Icons.explore_rounded),
                          label: const Text('Browse Marketplace'),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () =>
                            ref.refresh(threadListProvider.future),
                        child: _buildThreadList(context, isDark, r, threads, ref),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    bool isDark,
    Responsive r,
    WidgetRef ref,
    AsyncValue<List<ThreadModel>> threadsAsync,
  ) {
    return AppTopBar(
      title: 'Chats',
      actions: [
        if (threadsAsync.value?.isNotEmpty == true)
          TextButton.icon(
            onPressed: () => _confirmDeleteAll(context, ref),
            icon: const Icon(Icons.delete_sweep_rounded, size: 18),
            label: const Text('Clear all'),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
          ),
      ],
    );
  }

  Widget _buildThreadList(
    BuildContext context,
    bool isDark,
    Responsive r,
    List<ThreadModel> threads,
    WidgetRef ref,
  ) {
    return ListView.separated(
      padding: EdgeInsets.symmetric(horizontal: r.horizontalPadding, vertical: 8),
      itemCount: threads.length,
      separatorBuilder: (_, _) => Divider(
        height: 1,
        color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
      ),
      itemBuilder: (context, i) {
        final thread = threads[i];
        return Dismissible(
          key: Key(thread.id),
          direction: DismissDirection.endToStart,
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 20),
            color: AppColors.error,
            child: const Icon(Icons.delete_rounded, color: Colors.white),
          ),
          confirmDismiss: (_) => _confirmDelete(context),
          onDismissed: (_) {
            ref.read(threadListProvider.notifier).delete(thread.id);
          },
          child: _ThreadTile(
            thread: thread,
            isDark: isDark,
            onTap: () => context.push(
              RouteNames.chatPath(thread.id),
              extra: {'agentId': thread.agentId},
            ),
            onRename: () => _showRenameSheet(context, ref, thread),
          ),
        );
      },
    );
  }

  Future<bool?> _confirmDelete(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete chat?'),
        content: const Text('This conversation and its history will be removed.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDeleteAll(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all chats?'),
        content: const Text('All conversations will be permanently deleted.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Clear all'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(threadListProvider.notifier).deleteAll();
    }
  }

  Future<void> _showRenameSheet(
      BuildContext context, WidgetRef ref, ThreadModel thread) async {
    final controller = TextEditingController(text: thread.title);
    final newTitle = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.viewInsetsOf(ctx).bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Rename conversation',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (newTitle != null && newTitle.isNotEmpty && context.mounted) {
      await ref
          .read(threadListProvider.notifier)
          .renameThread(thread.id, newTitle);
    }
  }
}

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({
    required this.thread,
    required this.isDark,
    required this.onTap,
    required this.onRename,
  });

  final ThreadModel thread;
  final bool isDark;
  final VoidCallback onTap;
  final VoidCallback onRename;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      onLongPress: onRename,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.primaryLight.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          Icons.auto_awesome_rounded,
          color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
          size: 22,
        ),
      ),
      title: Text(
        thread.title,
        style: AppTypography.titleSmall.copyWith(
          color:
              isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        timeago.format(thread.lastMessageAt),
        style: AppTypography.bodySmall.copyWith(
          color: isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight,
        ),
      ),
      trailing: const Icon(Icons.chevron_right_rounded),
    );
  }
}
