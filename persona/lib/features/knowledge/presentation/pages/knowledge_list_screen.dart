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
import '../providers/knowledge_provider.dart';

class KnowledgeListScreen extends ConsumerWidget {
  const KnowledgeListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final kbsAsync = ref.watch(knowledgeListProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(title: 'Knowledge Bases'),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createKb(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New KB'),
        backgroundColor: isDark ? AppColors.primaryDark : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      body: kbsAsync.when(
        loading: () => ListView.builder(
          itemCount: 4,
          itemBuilder: (_, _) => const ListTileSkeleton(),
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(knowledgeListProvider.future),
        ),
        data: (kbs) => kbs.isEmpty
            ? const EmptyState(
                icon: Icons.library_books_outlined,
                title: 'No knowledge bases',
                subtitle:
                    'Upload documents to give your agents access to custom information',
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(knowledgeListProvider.future),
                child: ListView.separated(
                  padding: EdgeInsets.symmetric(
                      horizontal: r.horizontalPadding, vertical: 8),
                  itemCount: kbs.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: isDark
                        ? AppColors.dividerDark
                        : AppColors.dividerLight,
                  ),
                  itemBuilder: (context, i) {
                    final kb = kbs[i];
                    return ListTile(
                      onTap: () => context
                          .push(RouteNames.knowledgeDetailPath(kb.id)),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color:
                              AppColors.primaryLight.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.library_books_rounded,
                            color: isDark
                                ? AppColors.primaryDark
                                : AppColors.primaryLight),
                      ),
                      title: Text(kb.name, style: AppTypography.titleSmall),
                      subtitle: Text(
                        kb.description.isNotEmpty
                            ? kb.description
                            : '${kb.documentCount} document${kb.documentCount == 1 ? '' : 's'}',
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
                          Text(
                            '${kb.documentCount} docs',
                            style: AppTypography.labelSmall.copyWith(
                              color: isDark
                                  ? AppColors.textSecondaryDark
                                  : AppColors.textSecondaryLight,
                            ),
                          ),
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

  Future<void> _createKb(BuildContext context, WidgetRef ref) async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Knowledge Base'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name',
                hintText: 'My Docs',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Create')),
        ],
      ),
    );

    if (ok != true || nameCtrl.text.trim().isEmpty) return;

    try {
      await ref.read(knowledgeListProvider.notifier).create(
            name: nameCtrl.text.trim(),
            description: descCtrl.text.trim(),
          );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }
}
