import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../../../provider_keys/presentation/providers/provider_notifier.dart';
import '../../../mcp_servers/data/models/mcp_model.dart';
import '../../../mcp_servers/presentation/providers/mcp_provider.dart';
import '../../../skills/data/models/skill_model.dart';
import '../../../skills/presentation/providers/skills_provider.dart';
import '../../../knowledge/data/models/knowledge_model.dart';
import '../../../knowledge/presentation/providers/knowledge_provider.dart';
import '../providers/agent_provider.dart';

class AgentFormScreen extends ConsumerStatefulWidget {
  const AgentFormScreen({super.key, this.agentId});

  final String? agentId;

  @override
  ConsumerState<AgentFormScreen> createState() => _AgentFormScreenState();
}

class _AgentFormScreenState extends ConsumerState<AgentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _initialLoad = true;

  // Identity
  final _nameCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _category = 'other';
  String _visibility = 'private';
  List<String> _tags = [];

  // Intelligence
  String? _providerId;
  String _modelName = '';
  final _promptCtrl = TextEditingController();
  bool _webSearch = false;
  List<String> _providerModels = [];

  // Capabilities
  List<String> _selectedSkills = [];
  List<String> _selectedMcps = [];
  List<String> _selectedKbs = [];

  bool get _isEdit => widget.agentId != null;

  @override
  void initState() {
    super.initState();
    _nameCtrl.addListener(_onNameChanged);
    if (_isEdit) _loadExistingAgent();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _slugCtrl.dispose();
    _descCtrl.dispose();
    _promptCtrl.dispose();
    super.dispose();
  }

  void _onNameChanged() {
    if (!_isEdit && _slugCtrl.text.isEmpty ||
        _slugCtrl.text ==
            _nameCtrl.text
                .toLowerCase()
                .replaceAll(RegExp(r'[^a-z0-9]+'), '-')) {
      _slugCtrl.text = _nameCtrl.text
          .toLowerCase()
          .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
          .replaceAll(RegExp(r'^-+|-+$'), '');
    }
  }

  Future<void> _loadExistingAgent() async {
    try {
      final resp = await ref
          .read(agentDatasourceProvider)
          .getAgentById(widget.agentId!);
      final agent = resp.data!;
      setState(() {
        _nameCtrl.text = agent.name;
        _slugCtrl.text = agent.slug;
        _descCtrl.text = agent.description;
        _category = agent.category;
        _visibility = agent.visibility;
        _tags = List.from(agent.tags);
        _providerId = agent.providerId.isEmpty ? null : agent.providerId;
        _modelName = agent.modelName;
        _promptCtrl.text = agent.systemPrompt;
        _webSearch = agent.webSearchEnabled;
        _selectedSkills = List.from(agent.skills);
        _selectedMcps = List.from(agent.mcps);
        _selectedKbs = List.from(agent.knowledgeBases);
        _initialLoad = false;
      });
    } catch (_) {
      setState(() => _initialLoad = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);

    if (_isEdit && _initialLoad) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit Agent')),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              SkeletonBox(height: 56),
              SizedBox(height: 12),
              SkeletonBox(height: 56),
              SizedBox(height: 12),
              SkeletonBox(height: 120),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Agent' : 'Create Agent'),
        backgroundColor:
            isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        surfaceTintColor: Colors.transparent,
      ),
      body: ResponsiveCenter(
        padding: EdgeInsets.symmetric(horizontal: r.horizontalPadding),
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(top: 8, bottom: 100),
            children: [
              _buildSection(isDark, 'Identity', [
                _field(isDark, controller: _nameCtrl, label: 'Name',
                    hint: 'My Awesome Agent',
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Name is required' : null),
                const SizedBox(height: 12),
                _field(isDark,
                    controller: _slugCtrl,
                    label: 'Slug',
                    hint: 'my-awesome-agent'),
                const SizedBox(height: 12),
                _field(isDark,
                    controller: _descCtrl,
                    label: 'Description',
                    hint: 'What does this agent do?',
                    maxLines: 3),
                const SizedBox(height: 12),
                _buildDropdown(isDark, 'Category', _category, [
                  'productivity',
                  'coding',
                  'creative',
                  'research',
                  'roleplay',
                  'other'
                ], (v) => setState(() => _category = v!)),
                const SizedBox(height: 12),
                _buildDropdown(isDark, 'Visibility', _visibility,
                    ['private', 'unlisted', 'public'],
                    (v) => setState(() => _visibility = v!)),
                const SizedBox(height: 12),
                _buildTagInput(isDark),
              ]),
              const SizedBox(height: 16),
              _buildSection(isDark, 'Intelligence', [
                _buildProviderPicker(isDark),
                const SizedBox(height: 12),
                if (_providerModels.isNotEmpty)
                  _buildDropdown(isDark, 'Model', _modelName, _providerModels,
                      (v) => setState(() => _modelName = v ?? ''))
                else
                  _field(isDark,
                      controller: TextEditingController(text: _modelName),
                      label: 'Model',
                      hint: 'e.g. gpt-4o',
                      onChanged: (v) => _modelName = v),
                const SizedBox(height: 12),
                _field(isDark,
                    controller: _promptCtrl,
                    label: 'System Prompt',
                    hint: 'You are a helpful assistant…',
                    maxLines: 6,
                    mono: true,
                    validator: (v) => v == null || v.trim().isEmpty
                        ? 'System prompt is required'
                        : null),
                const SizedBox(height: 8),
                SwitchListTile(
                  value: _webSearch,
                  onChanged: (v) => setState(() => _webSearch = v),
                  title: Text('Web Search',
                      style: AppTypography.bodyMedium.copyWith(
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      )),
                  subtitle: const Text('Allow agent to search the web'),
                  contentPadding: EdgeInsets.zero,
                ),
              ]),
              const SizedBox(height: 16),
              _buildSection(isDark, 'Capabilities', [
                _buildMultiPickerRow(
                  isDark,
                  icon: Icons.psychology_rounded,
                  label: 'Skills',
                  count: _selectedSkills.length,
                  onTap: () => _showSkillPicker(context),
                ),
                const SizedBox(height: 8),
                _buildMultiPickerRow(
                  isDark,
                  icon: Icons.hub_rounded,
                  label: 'MCP Servers',
                  count: _selectedMcps.length,
                  onTap: () => _showMcpPicker(context),
                ),
                const SizedBox(height: 8),
                _buildMultiPickerRow(
                  isDark,
                  icon: Icons.library_books_rounded,
                  label: 'Knowledge Bases',
                  count: _selectedKbs.length,
                  onTap: () => _showKbPicker(context),
                ),
              ]),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(
              horizontal: Responsive.of(context).horizontalPadding,
              vertical: 12),
          child: SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: _loading ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: isDark
                    ? AppColors.primaryDark
                    : AppColors.primaryLight,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white),
                    )
                  : Text(_isEdit ? 'Save Changes' : 'Create Agent',
                      style: AppTypography.labelLarge),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSection(bool isDark, String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTypography.titleSmall.copyWith(
            color: isDark
                ? AppColors.textPrimaryDark
                : AppColors.textPrimaryLight,
          ),
        ),
        const SizedBox(height: 10),
        ...children,
      ],
    );
  }

  Widget _field(
    bool isDark, {
    required TextEditingController controller,
    required String label,
    String? hint,
    int maxLines = 1,
    bool mono = false,
    String? Function(String?)? validator,
    void Function(String)? onChanged,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      onChanged: onChanged,
      validator: validator,
      style: mono ? AppTypography.mono.copyWith(fontSize: 13) : null,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  Widget _buildDropdown(
    bool isDark,
    String label,
    String value,
    List<String> options,
    void Function(String?) onChanged,
  ) {
    return DropdownButtonFormField<String>(
      initialValue: options.contains(value) ? value : options.first,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
      items: options.map((o) {
        return DropdownMenuItem(
          value: o,
          child: Text(o[0].toUpperCase() + o.substring(1)),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }

  Widget _buildTagInput(bool isDark) {
    final tagCtrl = TextEditingController();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tags',
            style: AppTypography.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            )),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            ..._tags.map((tag) => InputChip(
                  label: Text(tag),
                  onDeleted: () => setState(() => _tags.remove(tag)),
                  deleteIconColor: AppColors.error,
                )),
            SizedBox(
              width: 120,
              height: 32,
              child: TextField(
                controller: tagCtrl,
                style: AppTypography.bodySmall,
                decoration: InputDecoration(
                  hintText: 'Add tag…',
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
                onSubmitted: (v) {
                  final trimmed = v.trim().toLowerCase();
                  if (trimmed.isNotEmpty && !_tags.contains(trimmed)) {
                    setState(() => _tags.add(trimmed));
                  }
                  tagCtrl.clear();
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildProviderPicker(bool isDark) {
    final providers = ref.watch(providerListProvider).value ?? [];

    return DropdownButtonFormField<String>(
      initialValue: _providerId,
      decoration: InputDecoration(
        labelText: 'Provider',
        filled: true,
        fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
      hint: const Text('Select provider'),
      items: providers.map((p) {
        return DropdownMenuItem(value: p.id, child: Text(p.label));
      }).toList(),
      onChanged: (id) async {
        setState(() => _providerId = id);
        if (id != null) {
          try {
            final models =
                await ref.read(providerListProvider.notifier).getModels(id);
            setState(() {
              _providerModels = models;
              if (models.isNotEmpty) _modelName = models.first;
            });
          } catch (_) {}
        }
      },
    );
  }

  Widget _buildMultiPickerRow(
    bool isDark, {
    required IconData icon,
    required String label,
    required int count,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: (isDark ? AppColors.primaryDark : AppColors.primaryLight)
              .withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon,
            size: 18,
            color:
                isDark ? AppColors.primaryDark : AppColors.primaryLight),
      ),
      title: Text(
        label,
        style: AppTypography.bodyMedium.copyWith(
          color: isDark
              ? AppColors.textPrimaryDark
              : AppColors.textPrimaryLight,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (count > 0)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: (isDark ? AppColors.primaryDark : AppColors.primaryLight)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '$count selected',
                style: AppTypography.labelSmall.copyWith(
                  color: isDark
                      ? AppColors.primaryDark
                      : AppColors.primaryLight,
                ),
              ),
            ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }

  Future<void> _showSkillPicker(BuildContext context) async {
    final skills = ref.read(mySkillsProvider).value ?? [];
    final selected = List<String>.from(_selectedSkills);

    final result = await _showMultiPickerSheet<SkillModel>(
      context: context,
      title: 'Select Skills',
      items: skills,
      selectedIds: selected,
      idOf: (s) => s.id,
      labelOf: (s) => s.name,
      subtitleOf: (s) => s.description,
    );

    if (result != null) setState(() => _selectedSkills = result);
  }

  Future<void> _showMcpPicker(BuildContext context) async {
    final mcps = ref.read(mcpListProvider).value ?? [];
    final selected = List<String>.from(_selectedMcps);

    final result = await _showMultiPickerSheet<McpModel>(
      context: context,
      title: 'Select MCP Servers',
      items: mcps,
      selectedIds: selected,
      idOf: (m) => m.id,
      labelOf: (m) => m.name,
      subtitleOf: (m) => m.serverUrl,
    );

    if (result != null) setState(() => _selectedMcps = result);
  }

  Future<void> _showKbPicker(BuildContext context) async {
    final kbs = ref.read(knowledgeListProvider).value ?? [];
    final selected = List<String>.from(_selectedKbs);

    final result = await _showMultiPickerSheet<KnowledgeBaseModel>(
      context: context,
      title: 'Select Knowledge Bases',
      items: kbs,
      selectedIds: selected,
      idOf: (kb) => kb.id,
      labelOf: (kb) => kb.name,
      subtitleOf: (kb) => kb.description,
    );

    if (result != null) setState(() => _selectedKbs = result);
  }

  Future<List<String>?> _showMultiPickerSheet<T>({
    required BuildContext context,
    required String title,
    required List<T> items,
    required List<String> selectedIds,
    required String Function(T) idOf,
    required String Function(T) labelOf,
    required String Function(T) subtitleOf,
  }) {
    final current = List<String>.from(selectedIds);

    return showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return DraggableScrollableSheet(
            initialChildSize: 0.7,
            maxChildSize: 0.95,
            minChildSize: 0.4,
            expand: false,
            builder: (ctx, scrollCtrl) {
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Text(title,
                            style: AppTypography.titleMedium),
                        const Spacer(),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, current),
                          child: const Text('Done'),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: items.isEmpty
                        ? Center(
                            child: Text('No items',
                                style: AppTypography.bodyMedium),
                          )
                        : ListView.builder(
                            controller: scrollCtrl,
                            itemCount: items.length,
                            itemBuilder: (ctx, i) {
                              final item = items[i];
                              final id = idOf(item);
                              final isSelected = current.contains(id);

                              return CheckboxListTile(
                                value: isSelected,
                                onChanged: (v) {
                                  setSheetState(() {
                                    if (v == true) {
                                      current.add(id);
                                    } else {
                                      current.remove(id);
                                    }
                                  });
                                },
                                title: Text(labelOf(item)),
                                subtitle: Text(
                                  subtitleOf(item),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'slug': _slugCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'category': _category,
        'visibility': _visibility,
        'tags': _tags,
        'systemPrompt': _promptCtrl.text.trim(),
        'webSearchEnabled': _webSearch,
        if (_providerId != null) 'providerId': _providerId,
        if (_modelName.isNotEmpty) 'modelName': _modelName,
        'skills': _selectedSkills,
        'mcps': _selectedMcps,
        'knowledgeBases': _selectedKbs,
      };

      final ds = ref.read(agentDatasourceProvider);
      if (_isEdit) {
        await ds.updateAgent(widget.agentId!, data);
      } else {
        await ds.createAgent(data);
      }

      await ref.read(myAgentsProvider.notifier).refresh();
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}
