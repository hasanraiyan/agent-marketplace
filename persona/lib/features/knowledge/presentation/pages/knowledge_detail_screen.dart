import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../providers/knowledge_provider.dart';

class KnowledgeDetailScreen extends ConsumerWidget {
  const KnowledgeDetailScreen({super.key, required this.kbId});
  final String kbId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final kbsAsync = ref.watch(knowledgeListProvider);
    final docsAsync = ref.watch(knowledgeDetailProvider(kbId));

    final kb = kbsAsync.value?.firstWhere(
      (k) => k.id == kbId,
      orElse: () => kbsAsync.value!.first,
    );

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(
            title: kb?.name ?? 'Knowledge Base',
            actions: [
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded,
                    color: AppColors.error),
                onPressed: () => _deleteKb(context, ref),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _uploadDocument(context, ref),
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Upload Doc'),
        backgroundColor: isDark ? AppColors.primaryDark : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      body: docsAsync.when(
        loading: () => ListView.builder(
          itemCount: 4,
          itemBuilder: (_, _) => const ListTileSkeleton(),
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(knowledgeDetailProvider(kbId).future),
        ),
        data: (docs) => docs.isEmpty
            ? const EmptyState(
                icon: Icons.description_outlined,
                title: 'No documents yet',
                subtitle: 'Upload files to build your knowledge base',
              )
            : RefreshIndicator(
                onRefresh: () =>
                    ref.refresh(knowledgeDetailProvider(kbId).future),
                child: ListView.separated(
                  padding: EdgeInsets.symmetric(
                      horizontal: r.horizontalPadding, vertical: 8),
                  itemCount: docs.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: isDark
                        ? AppColors.dividerDark
                        : AppColors.dividerLight,
                  ),
                  itemBuilder: (context, i) {
                    final doc = docs[i];
                    return ListTile(
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color:
                              AppColors.primaryLight.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          _fileIcon(doc.fileType),
                          color: isDark
                              ? AppColors.primaryDark
                              : AppColors.primaryLight,
                        ),
                      ),
                      title:
                          Text(doc.sourceName, style: AppTypography.bodyMedium),
                      subtitle: Text(
                        '${doc.fileType.toUpperCase()} · ${_formatSize(doc.size ?? 0)}',
                        style: AppTypography.bodySmall.copyWith(
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline_rounded,
                            size: 20),
                        color: AppColors.error,
                        onPressed: () =>
                            _deleteDoc(context, ref, doc.sourceName),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }

  IconData _fileIcon(String fileType) {
    return switch (fileType.toLowerCase()) {
      'pdf' => Icons.picture_as_pdf_rounded,
      'txt' || 'md' => Icons.description_rounded,
      'csv' || 'xlsx' => Icons.table_chart_rounded,
      'docx' || 'doc' => Icons.article_rounded,
      _ => Icons.insert_drive_file_rounded,
    };
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '${bytes}B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)}KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  Future<void> _uploadDocument(BuildContext context, WidgetRef ref) async {
    // In a real app this would open a file picker.
    // For now show a text-based URL/source input sheet.
    final urlCtrl = TextEditingController();

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Upload Document', style: AppTypography.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: urlCtrl,
              decoration: const InputDecoration(
                labelText: 'File URL or source name',
                hintText: 'https://example.com/doc.pdf',
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Upload'),
              ),
            ),
          ],
        ),
      ),
    );

    if (ok != true || urlCtrl.text.trim().isEmpty) return;

    try {
      await ref
          .read(knowledgeDetailProvider(kbId).notifier)
          .uploadDocument(urlCtrl.text.trim());
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _deleteDoc(
      BuildContext context, WidgetRef ref, String sourceName) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete document?'),
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
    if (ok != true) return;
    await ref
        .read(knowledgeDetailProvider(kbId).notifier)
        .deleteDocument(sourceName);
  }

  Future<void> _deleteKb(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete knowledge base?'),
        content: const Text(
            'This will delete all documents and disconnect agents using this KB.'),
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
    if (ok != true) return;
    await ref.read(knowledgeListProvider.notifier).delete(kbId);
    if (context.mounted) Navigator.pop(context);
  }
}
