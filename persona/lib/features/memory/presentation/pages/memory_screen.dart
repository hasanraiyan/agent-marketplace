import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
import '../../../agent_marketplace/presentation/providers/agent_provider.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/memory_model.dart';
import '../providers/memory_provider.dart';

class MemoryScreen extends ConsumerStatefulWidget {
  const MemoryScreen({super.key});

  @override
  ConsumerState<MemoryScreen> createState() => _MemoryScreenState();
}

class _MemoryScreenState extends ConsumerState<MemoryScreen> {
  // Search
  final _searchCtrl = TextEditingController();
  String _query = '';

  // Create form
  bool _showNewForm = false;
  String _newScope = 'user';
  String? _newAgentId;
  final _newPathCtrl = TextEditingController();
  final _newContentCtrl = TextEditingController();
  bool _creating = false;

  // Edit state
  String? _editingFileId;
  final _editCtrl = TextEditingController();
  bool _saving = false;

  // Clear all - no local state needed, showDialog handles it synchronously

  @override
  void dispose() {
    _searchCtrl.dispose();
    _newPathCtrl.dispose();
    _newContentCtrl.dispose();
    _editCtrl.dispose();
    super.dispose();
  }

  void _clearSearch() {
    _searchCtrl.clear();
    setState(() => _query = '');
  }

  @override
  Widget build(BuildContext context) {
    final memoryAsync = ref.watch(memoryProvider);
    final agentsAsync = ref.watch(myAgentsProvider);

    return ConnectorPageScaffold(
      title: 'AI Memory',
      section: ConnectorSection.memory,
      child: memoryAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(memoryProvider.future),
        ),
        data: (memory) => RefreshIndicator(
          onRefresh: () => ref.refresh(memoryProvider.future),
          child: ConnectorScrollableContent(
            maxWidth: 1040,
            children: [
              // Header
              ConnectorIntro(
                title: 'AI Memory Dashboard',
                description:
                    'Memory is stored as markdown files your agents read and update across conversations.',
                trailing: FilledButton.icon(
                  onPressed: () {
                    setState(() {
                      _showNewForm = !_showNewForm;
                      if (!_showNewForm) _resetNewForm();
                    });
                  },
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                  icon: Icon(
                    _showNewForm ? Icons.close_rounded : Icons.add_rounded,
                    size: 18,
                  ),
                  label: Text(_showNewForm ? 'Cancel' : 'New Memory File'),
                ),
              ),

              // Create Form
              if (_showNewForm)
                _CreateForm(
                  scope: _newScope,
                  agentId: _newAgentId,
                  agentsAsync: agentsAsync,
                  pathCtrl: _newPathCtrl,
                  contentCtrl: _newContentCtrl,
                  creating: _creating,
                  onScopeChanged: (v) => setState(() => _newScope = v),
                  onAgentChanged: (v) => setState(() => _newAgentId = v),
                  onCreate: _handleCreate,
                ),

              // Empty state
              if (!_showNewForm && memory.totalCount == 0)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 60),
                  child: EmptyState(
                    icon: Icons.memory_rounded,
                    title: 'No memories stored yet',
                    subtitle:
                        'Agents save memory files automatically as they learn during conversations, or you can create files manually.',
                    action: FilledButton.icon(
                      onPressed: () => setState(() => _showNewForm = true),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Create Memory File'),
                    ),
                  ),
                )
              else ...[
                // Search
                if (memory.totalCount > 0) ...[
                  ConnectorSearchField(
                    controller: _searchCtrl,
                    hintText:
                        'Search memory files by path, content, or agent...',
                    onChanged: (v) => setState(() => _query = v),
                    onClear: _clearSearch,
                  ),
                  const SizedBox(height: 18),
                ],

                // Two-column layout on wide screens
                _MemoryGrid(
                  memory: memory,
                  query: _query,
                  editingFileId: _editingFileId,
                  editCtrl: _editCtrl,
                  saving: _saving,
                  onClearSearch: _clearSearch,
                  onStartEdit: (file) {
                    _editCtrl.text = file.content;
                    setState(() => _editingFileId = file.fileId);
                  },
                  onCancelEdit: () {
                    _editCtrl.clear();
                    setState(() => _editingFileId = null);
                  },
                  onSaveEdit: (file) => _handleSaveEdit(file),
                  onDelete: (file) => _handleDelete(file),
                  onClearAll: _handleClearAllConfirm,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _resetNewForm() {
    _newScope = 'user';
    _newAgentId = null;
    _newPathCtrl.clear();
    _newContentCtrl.clear();
    _creating = false;
  }

  Future<void> _handleCreate() async {
    final path = _newPathCtrl.text.trim();
    final content = _newContentCtrl.text.trim();
    if (path.isEmpty || content.isEmpty) {
      _showSnack('File path and content are required.');
      return;
    }
    if (_newScope == 'agent' && _newAgentId == null) {
      _showSnack('Select an agent for agent-scoped memory.');
      return;
    }
    setState(() => _creating = true);
    try {
      await ref.read(memoryProvider.notifier).createFile(
            scope: _newScope,
            agentId: _newScope == 'agent' ? _newAgentId : null,
            path: path,
            content: content,
          );
      _resetNewForm();
      if (mounted) _showSnack('Memory file saved');
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _handleSaveEdit(MemoryFileModel file) async {
    setState(() => _saving = true);
    try {
      await ref.read(memoryProvider.notifier).editFile(
            scope: file.scope,
            agentId: file.scope == 'agent' ? file.agentId : null,
            path: file.path,
            content: _editCtrl.text,
          );
      if (mounted) {
        setState(() {
          _editingFileId = null;
          _editCtrl.clear();
        });
        _showSnack('Memory file updated');
      }
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _handleDelete(MemoryFileModel file) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete memory file?'),
        content: Text('Delete "${file.path}"? This cannot be undone.'),
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
      await ref.read(memoryProvider.notifier).deleteFile(
            scope: file.scope,
            agentId: file.scope == 'agent' ? file.agentId : null,
            path: file.path,
          );
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  Future<void> _handleClearAllConfirm() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.warning_rounded, size: 20, color: AppColors.error),
            const SizedBox(width: 8),
            const Text('Clear All Memory?'),
          ],
        ),
        content: const Text(
          'This will permanently delete all user memory files and all per-agent memory files. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            icon: const Icon(Icons.delete_forever_rounded, size: 16),
            label: const Text('Yes, Clear Everything'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(memoryProvider.notifier).clearAll();
      if (mounted) _showSnack('All memory cleared');
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

// ─── Create Form ───────────────────────────────────────────────────────────────

class _CreateForm extends StatelessWidget {
  const _CreateForm({
    required this.scope,
    required this.agentId,
    required this.agentsAsync,
    required this.pathCtrl,
    required this.contentCtrl,
    required this.creating,
    required this.onScopeChanged,
    required this.onAgentChanged,
    required this.onCreate,
  });

  final String scope;
  final String? agentId;
  final AsyncValue<List<AgentModel>> agentsAsync;
  final TextEditingController pathCtrl;
  final TextEditingController contentCtrl;
  final bool creating;
  final ValueChanged<String> onScopeChanged;
  final ValueChanged<String?> onAgentChanged;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: DetailCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.add_rounded, size: 18, color: AppColors.primaryLight),
                const SizedBox(width: 8),
                Text('Create Memory File', style: AppTypography.titleMedium),
              ],
            ),
            const SizedBox(height: 16),
            // Scope + Agent row
            Row(
              children: [
                Expanded(
                  child: _DropdownField(
                    label: 'Scope',
                    initialValue: scope,
                    items: const [
                      DropdownMenuItem(
                        value: 'user',
                        child: Text('User (all agents)'),
                      ),
                      DropdownMenuItem(
                        value: 'agent',
                        child: Text('Agent-specific'),
                      ),
                    ],
                    onChanged: (v) {
                      if (v != null) onScopeChanged(v);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                if (scope == 'agent')
                  Expanded(
                    child: agentsAsync.when(
                      loading: () => const SizedBox(
                        height: 48,
                        child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                      error: (_, _) => const SizedBox(
                        height: 48,
                        child: Center(child: Text('Failed to load agents')),
                      ),
                      data: (agents) => _DropdownField(
                        label: 'Agent',
                        initialValue: agentId,
                        items: [
                          const DropdownMenuItem(
                            value: null,
                            child: Text('Select agent...'),
                          ),
                          ...agents.map(
                            (a) => DropdownMenuItem(
                              value: a.id,
                              child: Text(a.name),
                            ),
                          ),
                        ],
                        onChanged: (v) => onAgentChanged(v as String?),
                      ),
                    ),
                  ),
                if (scope == 'user') const Expanded(child: SizedBox.shrink()),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pathCtrl,
              decoration: _inputDec('File Path',
                  hintText: 'e.g. /preferences.md'),
              style: AppTypography.mono,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: contentCtrl,
              minLines: 4,
              maxLines: 8,
              decoration: _inputDec('Content (markdown)'),
              style: AppTypography.mono,
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: creating ? null : onCreate,
                icon: creating
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded, size: 18),
                label: const Text('Save File'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDec(String label, {String? hintText}) {
    return InputDecoration(
      labelText: label,
      hintText: hintText,
      filled: true,
      fillColor: Colors.transparent,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: AppColors.dividerLight),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: AppColors.dividerLight),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.initialValue,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final dynamic initialValue;
  final List<DropdownMenuItem<dynamic>> items;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<dynamic>(
      initialValue: initialValue,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.transparent,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.dividerLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.dividerLight),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        isDense: true,
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

// ─── Memory Grid (files + sidebar) ─────────────────────────────────────────────

class _MemoryGrid extends StatelessWidget {
  const _MemoryGrid({
    required this.memory,
    required this.query,
    required this.editingFileId,
    required this.editCtrl,
    required this.saving,
    required this.onClearSearch,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
    required this.onDelete,
    required this.onClearAll,
  });

  final AllMemoryDataModel memory;
  final String query;
  final String? editingFileId;
  final TextEditingController editCtrl;
  final bool saving;
  final VoidCallback onClearSearch;
  final ValueChanged<MemoryFileModel> onStartEdit;
  final VoidCallback onCancelEdit;
  final ValueChanged<MemoryFileModel> onSaveEdit;
  final ValueChanged<MemoryFileModel> onDelete;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 920;

    if (isWide) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: _FileListColumn(
              memory: memory,
              query: query,
              editingFileId: editingFileId,
              editCtrl: editCtrl,
              saving: saving,
              onClearSearch: onClearSearch,
              onStartEdit: onStartEdit,
              onCancelEdit: onCancelEdit,
              onSaveEdit: onSaveEdit,
              onDelete: onDelete,
            ),
          ),
          const SizedBox(width: 16),
          SizedBox(
            width: 280,
            child: _SidebarColumn(
              memory: memory,
              onClearAll: onClearAll,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        _FileListColumn(
          memory: memory,
          query: query,
          editingFileId: editingFileId,
          editCtrl: editCtrl,
          saving: saving,
          onClearSearch: onClearSearch,
          onStartEdit: onStartEdit,
          onCancelEdit: onCancelEdit,
          onSaveEdit: onSaveEdit,
          onDelete: onDelete,
        ),
        const SizedBox(height: 16),
        _SidebarColumn(
          memory: memory,
          onClearAll: onClearAll,
        ),
      ],
    );
  }
}

// ─── File List Column ──────────────────────────────────────────────────────────

class _FileListColumn extends StatelessWidget {
  const _FileListColumn({
    required this.memory,
    required this.query,
    required this.editingFileId,
    required this.editCtrl,
    required this.saving,
    required this.onClearSearch,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
    required this.onDelete,
  });

  final AllMemoryDataModel memory;
  final String query;
  final String? editingFileId;
  final TextEditingController editCtrl;
  final bool saving;
  final VoidCallback onClearSearch;
  final ValueChanged<MemoryFileModel> onStartEdit;
  final VoidCallback onCancelEdit;
  final ValueChanged<MemoryFileModel> onSaveEdit;
  final ValueChanged<MemoryFileModel> onDelete;

  bool _matchesQuery(MemoryFileModel file, {String? agentName}) {
    if (query.trim().isEmpty) return true;
    final q = query.toLowerCase();
    return file.path.toLowerCase().contains(q) ||
        file.content.toLowerCase().contains(q) ||
        (agentName ?? '').toLowerCase().contains(q);
  }

  @override
  Widget build(BuildContext context) {
    final filteredUserFiles =
        memory.userFiles.where((f) => _matchesQuery(f)).toList();

    final filteredAgentGroups = memory.agentMemories
        .map((g) {
          final matchingFiles = g.files
              .where((f) => _matchesQuery(f, agentName: g.agentName))
              .toList();
          return matchingFiles.isEmpty ? null : g.copyWith(files: matchingFiles);
        })
        .whereType<AgentMemoryGroupModel>()
        .toList();

    final hasResults =
        filteredUserFiles.isNotEmpty || filteredAgentGroups.isNotEmpty;

    if (!hasResults && query.isNotEmpty) {
      return DetailCard(
        child: EmptyState(
          icon: Icons.search_rounded,
          title: 'No matching memories',
          subtitle: 'Try a different search term.',
          action: FilledButton.tonal(
            onPressed: onClearSearch,
            child: const Text('Clear search'),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // User Files
        if (filteredUserFiles.isNotEmpty) ...[
          DetailCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded,
                        size: 16, color: AppColors.info),
                    const SizedBox(width: 8),
                    Text('User Memory', style: AppTypography.titleMedium),
                    const Spacer(),
                    ConnectorBadge(
                      label: '${filteredUserFiles.length} files',
                      color: AppColors.info,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Files shared with all of your agents (/memories/user/).',
                  style: AppTypography.bodySmall,
                ),
                const SizedBox(height: 12),
                ...filteredUserFiles.map(
                  (file) => _MemoryFileTile(
                    file: file,
                    agentName: null,
                    isEditing: editingFileId == file.fileId,
                    editCtrl: editCtrl,
                    saving: saving,
                    onStartEdit: () => onStartEdit(file),
                    onCancelEdit: onCancelEdit,
                    onSaveEdit: () => onSaveEdit(file),
                    onDelete: () => onDelete(file),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Agent Memories
        if (filteredAgentGroups.isNotEmpty) ...[
          DetailCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.memory_rounded,
                        size: 16, color: AppColors.primaryLight),
                    const SizedBox(width: 8),
                    Text('Agent Memories', style: AppTypography.titleMedium),
                    const Spacer(),
                    ConnectorBadge(
                      label:
                          '${filteredAgentGroups.fold(0, (sum, g) => sum + g.files.length)} files',
                      color: AppColors.primaryLight,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Per-agent memory files (/memories/agent/), private to you.',
                  style: AppTypography.bodySmall,
                ),
                const SizedBox(height: 12),
                ...filteredAgentGroups.map(
                  (group) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            ConnectorBadge(
                              label: group.agentName ?? 'Unknown Agent',
                              color: AppColors.warning,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${group.files.length} file${group.files.length == 1 ? '' : 's'}',
                              style: AppTypography.bodySmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ...group.files.map(
                          (file) => _MemoryFileTile(
                            file: file,
                            agentName: group.agentName,
                            isEditing: editingFileId == file.fileId,
                            editCtrl: editCtrl,
                            saving: saving,
                            onStartEdit: () => onStartEdit(file),
                            onCancelEdit: onCancelEdit,
                            onSaveEdit: () => onSaveEdit(file),
                            onDelete: () => onDelete(file),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Memory File Tile ──────────────────────────────────────────────────────────

class _MemoryFileTile extends StatelessWidget {
  const _MemoryFileTile({
    required this.file,
    required this.agentName,
    required this.isEditing,
    required this.editCtrl,
    required this.saving,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
    required this.onDelete,
  });

  final MemoryFileModel file;
  final String? agentName;
  final bool isEditing;
  final TextEditingController editCtrl;
  final bool saving;
  final VoidCallback onStartEdit;
  final VoidCallback onCancelEdit;
  final VoidCallback onSaveEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.description_rounded,
                  size: 14, color: AppColors.primaryLight),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  file.path,
                  style: AppTypography.mono.copyWith(
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
              ),
              if (file.updatedAt != null)
                Text(
                  _formatDate(file.updatedAt!),
                  style: AppTypography.bodySmall,
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (isEditing) ...[
            TextField(
              controller: editCtrl,
              minLines: 3,
              maxLines: 10,
              style: AppTypography.mono.copyWith(fontSize: 12),
              decoration: InputDecoration(
                filled: true,
                fillColor:
                    isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.all(10),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: onCancelEdit,
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: saving ? null : onSaveEdit,
                  icon: saving
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_rounded, size: 16),
                  label: const Text('Save'),
                ),
              ],
            ),
          ] else ...[
            Text(
              file.content,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textPrimaryDark,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                SizedBox(
                  height: 28,
                  child: IconButton(
                    tooltip: 'Edit',
                    visualDensity: VisualDensity.compact,
                    onPressed: onStartEdit,
                    icon: Icon(Icons.edit_rounded,
                        size: 16, color: AppColors.primaryLight),
                  ),
                ),
                SizedBox(
                  height: 28,
                  child: IconButton(
                    tooltip: 'Delete',
                    visualDensity: VisualDensity.compact,
                    onPressed: onDelete,
                    icon: Icon(Icons.delete_outline_rounded,
                        size: 16, color: AppColors.error),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) {
      if (diff.inHours == 0) return '${diff.inMinutes}m ago';
      return '${diff.inHours}h ago';
    }
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.month}/${dt.day}/${dt.year}';
  }
}

// ─── Sidebar Column ────────────────────────────────────────────────────────────

class _SidebarColumn extends StatelessWidget {
  const _SidebarColumn({
    required this.memory,
    required this.onClearAll,
  });

  final AllMemoryDataModel memory;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Overview
        DetailCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.memory_rounded,
                      size: 16, color: AppColors.primaryLight),
                  const SizedBox(width: 8),
                  Text('Overview', style: AppTypography.titleMedium),
                ],
              ),
              const SizedBox(height: 16),
              _StatRow(
                label: 'User Memory Files',
                value: '${memory.userFileCount}',
              ),
              const Divider(height: 20),
              _StatRow(
                label: 'Agent Memory Files',
                value: '${memory.agentFileCount}',
              ),
              const Divider(height: 20),
              _StatRow(
                label: 'Agents with Memory',
                value: '${memory.agentCount}',
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // How Memory Works
        DetailCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.info_outline_rounded,
                      size: 16, color: AppColors.primaryLight),
                  const SizedBox(width: 8),
                  Text('How Memory Works', style: AppTypography.titleMedium),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'User Memory — Markdown files under /memories/user/, shared across all your agents.',
                style: AppTypography.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(
                'Agent Memory — Files under /memories/agent/, kept separately for each agent.',
                style: AppTypography.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(
                'You can view, edit, and delete any memory file from this dashboard.',
                style: AppTypography.bodySmall,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Danger Zone
        DetailCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_rounded,
                      size: 16, color: AppColors.error),
                  const SizedBox(width: 8),
                  Text('Danger Zone', style: AppTypography.titleMedium),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Permanently delete every memory file — user memory and all per-agent memories.',
                style: AppTypography.bodySmall,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: memory.totalCount == 0 ? null : onClearAll,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: BorderSide(
                        color: AppColors.error.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  icon:
                      const Icon(Icons.delete_forever_rounded, size: 16),
                  label: const Text('Clear All Memory'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTypography.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: (isDark ? AppColors.primaryDark : AppColors.primaryLight)
                .withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            value,
            style: AppTypography.badge.copyWith(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
            ),
          ),
        ),
      ],
    );
  }
}
