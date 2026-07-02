import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../data/models/thread_model.dart';
import '../providers/thread_provider.dart';

/// Inline conversation list rendered directly inside the side drawer.
///
/// Mirrors the web `NavThreads` component: a collapsible "Chats" section with a
/// scrollable, recency-sorted list of threads. Each row shows the agent avatar +
/// thread title, highlights the active thread, and offers rename / delete.
///
/// Designed to be placed inside the drawer's [Column] wrapped in an [Expanded]
/// so the list scrolls and the footer stays pinned to the bottom.
class SidebarThreadList extends ConsumerStatefulWidget {
  const SidebarThreadList({
    super.key,
    required this.isDark,
    required this.permanent,
  });

  /// Current theme brightness (passed down from the drawer).
  final bool isDark;

  /// True on the tablet permanent rail; false inside the phone [Drawer].
  /// Controls whether tapping a thread first closes the drawer.
  final bool permanent;

  @override
  ConsumerState<SidebarThreadList> createState() => _SidebarThreadListState();
}

class _SidebarThreadListState extends ConsumerState<SidebarThreadList> {
  bool _expanded = true;

  bool get isDark => widget.isDark;

  @override
  Widget build(BuildContext context) {
    final threadsAsync = ref.watch(threadListProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _Header(
          isDark: isDark,
          expanded: _expanded,
          onTap: () => setState(() => _expanded = !_expanded),
        ),
        if (_expanded)
          Expanded(
            child: threadsAsync.when(
              loading: () => const _LoadingList(),
              error: (e, _) => _ErrorTile(
                isDark: isDark,
                onRetry: () => ref.invalidate(threadListProvider),
              ),
              data: (threads) => threads.isEmpty
                  ? _EmptyTile(isDark: isDark)
                  : _ThreadListView(
                      threads: threads,
                      isDark: isDark,
                      permanent: widget.permanent,
                      onRename: _showRenameSheet,
                      onDelete: _confirmDelete,
                    ),
            ),
          ),
      ],
    );
  }

  // ── Active thread detection ───────────────────────────────────────────────

  Future<void> _confirmDelete(ThreadModel thread) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete chat?'),
        content:
            const Text('This conversation and its history will be removed.'),
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
    if (ok == true) {
      await ref.read(threadListProvider.notifier).delete(thread.id);
    }
  }

  Future<void> _showRenameSheet(ThreadModel thread) async {
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
            const Text(
              'Rename conversation',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Title'),
              onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
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
    if (newTitle != null && newTitle.isNotEmpty && mounted) {
      await ref
          .read(threadListProvider.notifier)
          .renameThread(thread.id, newTitle);
    }
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({
    required this.isDark,
    required this.expanded,
    required this.onTap,
  });

  final bool isDark;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 2),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          splashColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            child: Row(
              children: [
                Text(
                  'Chats',
                  style: AppTypography.labelMedium.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 11.5,
                    letterSpacing: 0.3,
                  ),
                ),
                const Spacer(),
                AnimatedRotation(
                  turns: expanded ? 0.25 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Thread list ───────────────────────────────────────────────────────────────

class _ThreadListView extends ConsumerWidget {
  const _ThreadListView({
    required this.threads,
    required this.isDark,
    required this.permanent,
    required this.onRename,
    required this.onDelete,
  });

  final List<ThreadModel> threads;
  final bool isDark;
  final bool permanent;
  final ValueChanged<ThreadModel> onRename;
  final ValueChanged<ThreadModel> onDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeThreadId = GoRouterState.of(context).pathParameters['threadId'];

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      itemCount: threads.length,
      itemBuilder: (context, i) {
        final thread = threads[i];
        return _ThreadTile(
          thread: thread,
          isDark: isDark,
          isActive: thread.id == activeThreadId,
          onTap: () {
            if (!permanent) Navigator.of(context).maybePop();
            context.push(
              RouteNames.chatPath(thread.id),
              extra: {'agentId': thread.agentId},
            );
          },
          onRename: () => onRename(thread),
          onDelete: () => onDelete(thread),
        );
      },
    );
  }
}

// ── Single thread tile ────────────────────────────────────────────────────────

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({
    required this.thread,
    required this.isDark,
    required this.isActive,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
  });

  final ThreadModel thread;
  final bool isDark;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final activeColor =
        isDark ? AppColors.primaryDark : AppColors.primaryLight;
    final textColor =
        isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
    final activeBg = activeColor.withValues(alpha: 0.1);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 0.5),
      decoration: BoxDecoration(
        color: isActive ? activeBg : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          onLongPress: onRename,
          borderRadius: BorderRadius.circular(8),
          highlightColor:
              (isDark ? AppColors.inputFillDark : AppColors.inputFillLight)
                  .withValues(alpha: 0.6),
          splashColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 2, 4),
            child: Row(
              children: [
                _AgentAvatar(thread: thread, isDark: isDark),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    thread.title,
                    style: AppTypography.bodySmall.copyWith(
                      color: isActive ? activeColor : textColor,
                      fontWeight:
                          isActive ? FontWeight.w600 : FontWeight.w500,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _OverflowMenu(
                  isDark: isDark,
                  onRename: onRename,
                  onDelete: onDelete,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Agent avatar ──────────────────────────────────────────────────────────────

class _AgentAvatar extends StatelessWidget {
  const _AgentAvatar({required this.thread, required this.isDark});

  final ThreadModel thread;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final url = thread.agentAvatarUrl;
    final fallbackBg =
        isDark ? AppColors.inputFillDark : AppColors.inputFillLight;
    final iconColor =
        isDark ? AppColors.primaryDark : AppColors.primaryLight;

    if (url != null) {
      return CircleAvatar(
        radius: 11,
        backgroundColor: fallbackBg,
        backgroundImage: NetworkImage(url),
      );
    }

    final name = thread.agentName;
    final initial = (name != null && name.isNotEmpty)
        ? name[0].toUpperCase()
        : null;

    return CircleAvatar(
      radius: 11,
      backgroundColor: fallbackBg,
      child: initial != null
          ? Text(
              initial,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: iconColor,
              ),
            )
          : Icon(Icons.smart_toy_rounded, size: 12, color: iconColor),
    );
  }
}

// ── Overflow (rename / delete) menu ───────────────────────────────────────────

class _OverflowMenu extends StatelessWidget {
  const _OverflowMenu({
    required this.isDark,
    required this.onRename,
    required this.onDelete,
  });

  final bool isDark;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'More',
      padding: EdgeInsets.zero,
      splashRadius: 16,
      position: PopupMenuPosition.under,
      onSelected: (v) {
        if (v == 'rename') onRename();
        if (v == 'delete') onDelete();
      },
      // Use `child` (not `icon`) so the trigger is a plain InkWell instead of
      // an IconButton, which would force a 48px min-height on every row.
      child: SizedBox(
        width: 28,
        height: 28,
        child: Icon(
          Icons.more_horiz_rounded,
          size: 16,
          color: isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight,
        ),
      ),
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'rename',
          height: 40,
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 16),
              SizedBox(width: 10),
              Text('Rename'),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'delete',
          height: 40,
          child: Row(
            children: [
              Icon(Icons.delete_outline_rounded,
                  size: 16, color: AppColors.error),
              const SizedBox(width: 10),
              Text('Delete', style: TextStyle(color: AppColors.error)),
            ],
          ),
        ),
      ],
    );
  }
}

// ── States ────────────────────────────────────────────────────────────────────

class _LoadingList extends StatelessWidget {
  const _LoadingList();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark
        ? Colors.white.withValues(alpha: 0.06)
        : Colors.black.withValues(alpha: 0.05);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      itemCount: 6,
      itemBuilder: (_, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 8),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(color: base, shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                height: 11,
                decoration: BoxDecoration(
                  color: base,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  const _EmptyTile({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final color = (isDark
            ? AppColors.textSecondaryDark
            : AppColors.textSecondaryLight)
        .withValues(alpha: 0.7);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      child: Column(
        children: [
          Icon(Icons.chat_bubble_outline_rounded,
              size: 26, color: color.withValues(alpha: 0.5)),
          const SizedBox(height: 8),
          Text(
            'No chats yet.\nStart a conversation!',
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall.copyWith(color: color, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.isDark, required this.onRetry});

  final bool isDark;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        children: [
          Text(
            "Couldn't load chats",
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Retry', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
