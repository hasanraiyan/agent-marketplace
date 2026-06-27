import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/knowledge_model.dart';
import '../providers/knowledge_provider.dart';

class KnowledgeDetailScreen extends ConsumerStatefulWidget {
  const KnowledgeDetailScreen({super.key, required this.kbId});

  final String kbId;

  @override
  ConsumerState<KnowledgeDetailScreen> createState() =>
      _KnowledgeDetailScreenState();
}

class _KnowledgeDetailScreenState extends ConsumerState<KnowledgeDetailScreen> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String? _loadedKbId;
  bool _saving = false;
  double? _uploadProgress;

  static const _allowedExtensions = ['pdf', 'txt', 'md', 'json', 'csv'];
  static const _maxFileBytes = 20 * 1024 * 1024;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final kbAsync = ref.watch(knowledgeBaseProvider(widget.kbId));
    final docsAsync = ref.watch(knowledgeDocumentsProvider(widget.kbId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ConnectorPageScaffold(
      title: 'Knowledge Base',
      section: ConnectorSection.knowledge,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploadProgress == null ? _pickAndUpload : null,
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Upload'),
        backgroundColor: isDark
            ? AppColors.primaryDark
            : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      child: kbAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(knowledgeBaseProvider(widget.kbId).future),
        ),
        data: (kb) {
          if (_loadedKbId != kb.id) {
            _nameCtrl.text = kb.name;
            _descCtrl.text = kb.description;
            _loadedKbId = kb.id;
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(knowledgeBaseProvider(widget.kbId));
              ref.invalidate(knowledgeDocumentsProvider(widget.kbId));
            },
            child: ConnectorScrollableContent(
              maxWidth: 980,
              children: [
                ConnectorIntro(
                  title: kb.name,
                  description: kb.description.isEmpty
                      ? 'Manage metadata and uploaded source documents.'
                      : kb.description,
                  trailing: OutlinedButton.icon(
                    onPressed: () => _deleteKb(kb),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Delete'),
                  ),
                ),
                _MetadataCard(
                  nameCtrl: _nameCtrl,
                  descCtrl: _descCtrl,
                  saving: _saving,
                  onSave: () => _saveMetadata(kb),
                ),
                const SizedBox(height: 14),
                _UploadCard(progress: _uploadProgress, onPick: _pickAndUpload),
                const SizedBox(height: 14),
                _DocumentsCard(docsAsync: docsAsync, onDelete: _deleteDocument),
                const SizedBox(height: 14),
                DetailCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Retrieval Settings',
                        style: AppTypography.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      KeyValueRow(label: 'Embedding', value: kb.embeddingModel),
                      KeyValueRow(
                        label: 'Chunk size',
                        value: '${kb.chunkSize}',
                      ),
                      KeyValueRow(
                        label: 'Overlap',
                        value: '${kb.chunkOverlap}',
                      ),
                      KeyValueRow(label: 'Top K', value: '${kb.topK}'),
                      KeyValueRow(
                        label: 'Documents',
                        value: '${kb.documentCount}',
                      ),
                      KeyValueRow(label: 'Chunks', value: '${kb.chunkCount}'),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _saveMetadata(KnowledgeBaseModel kb) async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Name is required')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(knowledgeListProvider.notifier)
          .editItem(
            kb.id,
            name: _nameCtrl.text.trim(),
            description: _descCtrl.text.trim(),
          );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Knowledge base updated')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final files = await openFiles(
      acceptedTypeGroups: const [
        XTypeGroup(label: 'Documents', extensions: _allowedExtensions),
      ],
    );
    if (files.isEmpty) return;

    if (files.length > 10) {
      _showSnack('Select up to 10 files at a time.');
      return;
    }

    final paths = <String>[];
    for (final file in files) {
      final extension = file.name.split('.').last.toLowerCase();
      if (!_allowedExtensions.contains(extension)) {
        _showSnack('${file.name} is not a supported file type.');
        return;
      }
      final size = await file.length();
      if (size > _maxFileBytes) {
        _showSnack('${file.name} is larger than 20MB.');
        return;
      }
      if (file.path.isEmpty) {
        _showSnack('${file.name} could not be read from this device.');
        return;
      }
      paths.add(file.path);
    }
    if (paths.isEmpty) return;

    setState(() => _uploadProgress = 0);
    try {
      await ref
          .read(knowledgeDocumentsProvider(widget.kbId).notifier)
          .uploadFiles(
            paths,
            onSendProgress: (sent, total) {
              if (total <= 0 || !mounted) return;
              setState(() => _uploadProgress = sent / total);
            },
          );
      if (mounted) _showSnack('Files uploaded');
    } catch (e) {
      if (mounted) _showSnack('Upload failed: $e');
    } finally {
      if (mounted) setState(() => _uploadProgress = null);
    }
  }

  Future<void> _deleteDocument(KnowledgeDocumentModel doc) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete document?'),
        content: Text('Remove ${doc.fileName} from this knowledge base?'),
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
    if (ok != true) return;
    try {
      await ref
          .read(knowledgeDocumentsProvider(widget.kbId).notifier)
          .deleteDocument(doc.sourceName);
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  Future<void> _deleteKb(KnowledgeBaseModel kb) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete knowledge base?'),
        content: const Text(
          'This deletes its document index and removes it from agents.',
        ),
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
    if (ok != true) return;
    try {
      await ref.read(knowledgeListProvider.notifier).delete(kb.id);
      if (mounted) context.go(RouteNames.knowledge);
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _MetadataCard extends StatelessWidget {
  const _MetadataCard({
    required this.nameCtrl,
    required this.descCtrl,
    required this.saving,
    required this.onSave,
  });

  final TextEditingController nameCtrl;
  final TextEditingController descCtrl;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Details', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: nameCtrl,
            decoration: _decoration(isDark, 'Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: descCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: _decoration(isDark, 'Description'),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: saving ? null : onSave,
              icon: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_rounded, size: 18),
              label: const Text('Save'),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _decoration(bool isDark, String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({required this.progress, required this.onPick});

  final double? progress;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Upload Files', style: AppTypography.titleMedium),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: progress == null ? onPick : null,
                icon: const Icon(Icons.upload_file_rounded, size: 18),
                label: const Text('Pick Files'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '.pdf, .txt, .md, .json, .csv. Up to 20MB each and 10 files per upload.',
            style: AppTypography.bodySmall,
          ),
          if (progress != null) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(value: progress),
          ],
        ],
      ),
    );
  }
}

class _DocumentsCard extends StatelessWidget {
  const _DocumentsCard({required this.docsAsync, required this.onDelete});

  final AsyncValue<List<KnowledgeDocumentModel>> docsAsync;
  final ValueChanged<KnowledgeDocumentModel> onDelete;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Documents', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          docsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(
              e.toString(),
              style: AppTypography.bodySmall.copyWith(color: AppColors.error),
            ),
            data: (docs) => docs.isEmpty
                ? Text(
                    'No documents uploaded yet.',
                    style: AppTypography.bodySmall,
                  )
                : Column(
                    children: docs
                        .map(
                          (doc) => _DocumentTile(
                            doc: doc,
                            onDelete: () => onDelete(doc),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.doc, required this.onDelete});

  final KnowledgeDocumentModel doc;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(_fileIcon(doc.fileType)),
      title: Text(doc.fileName, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${_formatSize(doc.fileSize)} | ${doc.chunkCount} chunks',
        style: AppTypography.bodySmall.copyWith(
          color: isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight,
        ),
      ),
      trailing: IconButton(
        tooltip: 'Delete document',
        onPressed: onDelete,
        color: AppColors.error,
        icon: const Icon(Icons.delete_outline_rounded),
      ),
    );
  }

  IconData _fileIcon(String fileType) {
    return switch (fileType.toLowerCase()) {
      'pdf' => Icons.picture_as_pdf_rounded,
      'txt' || 'md' => Icons.description_rounded,
      'csv' => Icons.table_chart_rounded,
      'json' => Icons.data_object_rounded,
      _ => Icons.insert_drive_file_rounded,
    };
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '${bytes}B';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)}KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)}MB';
  }
}
