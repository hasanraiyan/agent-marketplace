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
  final _searchCtrl = TextEditingController();
  final _keyCtrl = TextEditingController();
  final _valueCtrl = TextEditingController();
  final _editCtrl = TextEditingController();
  String _query = '';
  String? _selectedAgentId;
  String? _editingId;
  bool _saving = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    _keyCtrl.dispose();
    _valueCtrl.dispose();
    _editCtrl.dispose();
    super.dispose();
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
              const ConnectorIntro(
                title: 'AI Memory',
                description:
                    'Review profile memory and long-term agent memories across conversations.',
              ),
              _StatsRow(memory: memory),
              const SizedBox(height: 14),
              _ProfileMemoryCard(profile: memory.profile),
              const SizedBox(height: 14),
              agentsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => DetailCard(
                  child: Text(
                    e.toString(),
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.error,
                    ),
                  ),
                ),
                data: (agents) {
                  if (_selectedAgentId == null && agents.isNotEmpty) {
                    _selectedAgentId = agents.first.id;
                  }
                  return _CreateMemoryCard(
                    agents: agents,
                    selectedAgentId: _selectedAgentId,
                    keyCtrl: _keyCtrl,
                    valueCtrl: _valueCtrl,
                    saving: _saving,
                    onAgentChanged: (id) =>
                        setState(() => _selectedAgentId = id),
                    onCreate: () => _createMemory(agents),
                  );
                },
              ),
              const SizedBox(height: 14),
              _MemoryListCard(
                memories: memory.agentMemories,
                query: _query,
                searchCtrl: _searchCtrl,
                editingId: _editingId,
                editCtrl: _editCtrl,
                onQueryChanged: (value) => setState(() => _query = value),
                onClearSearch: () {
                  _searchCtrl.clear();
                  setState(() => _query = '');
                },
                onStartEdit: _startEdit,
                onCancelEdit: () => setState(() => _editingId = null),
                onSaveEdit: _saveEdit,
                onDelete: _deleteMemory,
              ),
              const SizedBox(height: 14),
              DetailCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Clear all profile and agent memory.',
                        style: AppTypography.bodyMedium,
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: memory.totalCount == 0
                          ? null
                          : _clearAllMemory,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.error,
                      ),
                      icon: const Icon(Icons.delete_forever_rounded, size: 18),
                      label: const Text('Clear All Memory'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _createMemory(List<AgentModel> agents) async {
    final agentId = _selectedAgentId;
    if (agentId == null || agents.isEmpty) {
      _showSnack('Create an agent before adding memory.');
      return;
    }
    if (_keyCtrl.text.trim().isEmpty || _valueCtrl.text.trim().isEmpty) {
      _showSnack('Key and value are required.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(memoryProvider.notifier)
          .create(
            agentId: agentId,
            key: _keyCtrl.text.trim(),
            value: _valueCtrl.text.trim(),
          );
      _keyCtrl.clear();
      _valueCtrl.clear();
      if (mounted) _showSnack('Memory created');
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _startEdit(AgentMemoryEntryModel entry) {
    _editCtrl.text = entry.valueText;
    setState(() => _editingId = _entryId(entry));
  }

  Future<void> _saveEdit(AgentMemoryEntryModel entry) async {
    try {
      await ref
          .read(memoryProvider.notifier)
          .editItem(
            agentId: entry.agentId,
            key: entry.key,
            value: _editCtrl.text,
          );
      if (mounted) {
        setState(() => _editingId = null);
        _showSnack('Memory updated');
      }
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  Future<void> _deleteMemory(AgentMemoryEntryModel entry) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete memory?'),
        content: Text('Delete "${entry.key}" from ${entry.agentName}?'),
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
          .read(memoryProvider.notifier)
          .delete(agentId: entry.agentId, key: entry.key);
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  Future<void> _clearAllMemory() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all memory?'),
        content: const Text(
          'This removes profile memory and all agent memories.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(memoryProvider.notifier).clearAll();
      if (mounted) _showSnack('Memory cleared');
    } catch (e) {
      if (mounted) _showSnack('Error: $e');
    }
  }

  String _entryId(AgentMemoryEntryModel entry) =>
      '${entry.agentId}::${entry.key}';

  void _showSnack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.memory});

  final MemoryDataModel memory;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _StatTile(label: 'Profile Items', value: '${memory.profile.itemCount}'),
        _StatTile(
          label: 'Agent Memories',
          value: '${memory.agentMemories.length}',
        ),
        _StatTile(label: 'Total Memory', value: '${memory.totalCount}'),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: DetailCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: AppTypography.headlineSmall),
            const SizedBox(height: 4),
            Text(label, style: AppTypography.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ProfileMemoryCard extends StatelessWidget {
  const _ProfileMemoryCard({required this.profile});

  final MemoryProfileModel profile;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profile Memory', style: AppTypography.titleMedium),
          const SizedBox(height: 10),
          KeyValueRow(
            label: 'Summary',
            value: profile.summary.trim().isEmpty
                ? 'No profile summary saved.'
                : profile.summary,
          ),
          const SizedBox(height: 8),
          if (profile.preferences.isEmpty)
            Text('No preferences saved.', style: AppTypography.bodySmall)
          else
            ...profile.preferences.entries.map(
              (entry) =>
                  KeyValueRow(label: entry.key, value: entry.value.toString()),
            ),
        ],
      ),
    );
  }
}

class _CreateMemoryCard extends StatelessWidget {
  const _CreateMemoryCard({
    required this.agents,
    required this.selectedAgentId,
    required this.keyCtrl,
    required this.valueCtrl,
    required this.saving,
    required this.onAgentChanged,
    required this.onCreate,
  });

  final List<AgentModel> agents;
  final String? selectedAgentId;
  final TextEditingController keyCtrl;
  final TextEditingController valueCtrl;
  final bool saving;
  final ValueChanged<String?> onAgentChanged;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Create Agent Memory', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          if (agents.isEmpty)
            Text('No agents available.', style: AppTypography.bodySmall)
          else
            DropdownButtonFormField<String>(
              initialValue: selectedAgentId,
              decoration: _decoration(isDark, 'Agent'),
              items: agents
                  .map(
                    (agent) => DropdownMenuItem(
                      value: agent.id,
                      child: Text(agent.name),
                    ),
                  )
                  .toList(),
              onChanged: onAgentChanged,
            ),
          const SizedBox(height: 12),
          TextField(
            controller: keyCtrl,
            decoration: _decoration(isDark, 'Key'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: valueCtrl,
            minLines: 3,
            maxLines: 6,
            decoration: _decoration(isDark, 'Value'),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: saving ? null : onCreate,
              icon: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_rounded, size: 18),
              label: const Text('Create Memory'),
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

class _MemoryListCard extends StatelessWidget {
  const _MemoryListCard({
    required this.memories,
    required this.query,
    required this.searchCtrl,
    required this.editingId,
    required this.editCtrl,
    required this.onQueryChanged,
    required this.onClearSearch,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
    required this.onDelete,
  });

  final List<AgentMemoryEntryModel> memories;
  final String query;
  final TextEditingController searchCtrl;
  final String? editingId;
  final TextEditingController editCtrl;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearSearch;
  final ValueChanged<AgentMemoryEntryModel> onStartEdit;
  final VoidCallback onCancelEdit;
  final ValueChanged<AgentMemoryEntryModel> onSaveEdit;
  final ValueChanged<AgentMemoryEntryModel> onDelete;

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final filtered = normalized.isEmpty
        ? memories
        : memories.where((entry) {
            final haystack =
                '${entry.agentName} ${entry.key} ${entry.valueText}'
                    .toLowerCase();
            return haystack.contains(normalized);
          }).toList();

    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Agent Memories', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          if (memories.isNotEmpty) ...[
            ConnectorSearchField(
              controller: searchCtrl,
              hintText: 'Search memories',
              onChanged: onQueryChanged,
              onClear: onClearSearch,
            ),
            const SizedBox(height: 12),
          ],
          if (memories.isEmpty)
            Text('No agent memories yet.', style: AppTypography.bodySmall)
          else if (filtered.isEmpty)
            EmptyState(
              icon: Icons.search_rounded,
              title: 'No matching memories',
              subtitle: 'Try another agent, key, or value.',
              action: FilledButton.tonal(
                onPressed: onClearSearch,
                child: const Text('Clear search'),
              ),
            )
          else
            ...filtered.map(
              (entry) => _MemoryEntryTile(
                entry: entry,
                isEditing: editingId == '${entry.agentId}::${entry.key}',
                editCtrl: editCtrl,
                onStartEdit: () => onStartEdit(entry),
                onCancelEdit: onCancelEdit,
                onSaveEdit: () => onSaveEdit(entry),
                onDelete: () => onDelete(entry),
              ),
            ),
        ],
      ),
    );
  }
}

class _MemoryEntryTile extends StatelessWidget {
  const _MemoryEntryTile({
    required this.entry,
    required this.isEditing,
    required this.editCtrl,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
    required this.onDelete,
  });

  final AgentMemoryEntryModel entry;
  final bool isEditing;
  final TextEditingController editCtrl;
  final VoidCallback onStartEdit;
  final VoidCallback onCancelEdit;
  final VoidCallback onSaveEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
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
              ConnectorBadge(label: entry.agentName, color: AppColors.info),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  entry.key,
                  style: AppTypography.titleSmall.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Edit memory',
                onPressed: onStartEdit,
                icon: const Icon(Icons.edit_rounded),
              ),
              IconButton(
                tooltip: 'Delete memory',
                color: AppColors.error,
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (isEditing)
            Column(
              children: [
                TextField(
                  controller: editCtrl,
                  minLines: 3,
                  maxLines: 8,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: isDark
                        ? AppColors.inputFillDark
                        : AppColors.inputFillLight,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
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
                    FilledButton(
                      onPressed: onSaveEdit,
                      child: const Text('Save'),
                    ),
                  ],
                ),
              ],
            )
          else
            Text(
              entry.valueText,
              style: AppTypography.bodyMedium.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
              ),
            ),
        ],
      ),
    );
  }
}
