import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/skill_model.dart';
import '../providers/skills_provider.dart';

class SkillFormScreen extends ConsumerStatefulWidget {
  const SkillFormScreen({super.key, this.skillId});
  final String? skillId;

  @override
  ConsumerState<SkillFormScreen> createState() => _SkillFormScreenState();
}

class _SkillFormScreenState extends ConsumerState<SkillFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _instructionsCtrl = TextEditingController();
  bool _isPublic = false;
  bool _loading = false;
  bool _loadingExisting = false;
  String? _loadError;

  bool get _isEdit => widget.skillId != null;
  String get _slug => _slugify(_nameCtrl.text);

  @override
  void initState() {
    super.initState();
    _nameCtrl.addListener(_refreshSlug);
    _descCtrl.addListener(_refreshCounters);
    _instructionsCtrl.addListener(_refreshCounters);
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _nameCtrl
      ..removeListener(_refreshSlug)
      ..dispose();
    _descCtrl
      ..removeListener(_refreshCounters)
      ..dispose();
    _instructionsCtrl
      ..removeListener(_refreshCounters)
      ..dispose();
    super.dispose();
  }

  void _refreshSlug() => setState(() {});
  void _refreshCounters() => setState(() {});

  Future<void> _loadExisting() async {
    setState(() {
      _loadingExisting = true;
      _loadError = null;
    });
    try {
      SkillModel? skill;
      for (final item in ref.read(mySkillsProvider).value ?? <SkillModel>[]) {
        if (item.id == widget.skillId) {
          skill = item;
          break;
        }
      }
      skill ??=
          (await ref
                  .read(skillDatasourceProvider)
                  .getSkillById(widget.skillId!))
              .data;
      if (!mounted || skill == null) return;
      _nameCtrl.text = skill.name;
      _descCtrl.text = skill.description;
      _instructionsCtrl.text = skill.instructions;
      setState(() {
        _isPublic = skill!.isPublic;
        _loadingExisting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString();
        _loadingExisting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ConnectorPageScaffold(
      title: _isEdit ? 'Edit Skill' : 'New Skill',
      section: ConnectorSection.skills,
      child: _loadingExisting
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? ErrorState(message: _loadError!, onRetry: _loadExisting)
          : Form(
              key: _formKey,
              child: ConnectorScrollableContent(
                maxWidth: 760,
                children: [
                  ConnectorIntro(
                    title: _isEdit ? 'Edit Skill' : 'Create Skill',
                    description:
                        'Write the SKILL.md instructions your agents should follow.',
                  ),
                  TextFormField(
                    controller: _nameCtrl,
                    maxLength: 64,
                    inputFormatters: [LengthLimitingTextInputFormatter(64)],
                    validator: (_) {
                      if (_slug.isEmpty) return 'Name is required';
                      if (_slug.length < 2) {
                        return 'Name must be at least 2 characters';
                      }
                      return null;
                    },
                    decoration: _decoration(
                      isDark,
                      label: 'Name',
                      hint: 'Search Web',
                    ),
                  ),
                  Text(
                    _slug.isEmpty
                        ? 'Use letters, numbers, and hyphens.'
                        : 'Will be saved as: $_slug',
                    style: AppTypography.bodySmall.copyWith(
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _descCtrl,
                    minLines: 3,
                    maxLines: 5,
                    maxLength: 1024,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.isEmpty) return 'Description is required';
                      if (text.length < 10) {
                        return 'Description must be at least 10 characters';
                      }
                      return null;
                    },
                    decoration: _decoration(
                      isDark,
                      label: 'Description',
                      hint: 'Searches the web for current information.',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _instructionsCtrl,
                    minLines: 14,
                    maxLines: 26,
                    maxLength: 50000,
                    style: AppTypography.mono.copyWith(
                      color: isDark
                          ? AppColors.textPrimaryDark
                          : AppColors.textPrimaryLight,
                    ),
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.isEmpty) return 'Instructions are required';
                      if (text.length < 10) {
                        return 'Instructions must be at least 10 characters';
                      }
                      return null;
                    },
                    decoration: _decoration(
                      isDark,
                      label: 'Instructions / SKILL.md',
                      hint:
                          '# Skill\n\nDescribe when and how the agent should use this workflow.',
                    ),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    value: _isPublic,
                    onChanged: (value) => setState(() => _isPublic = value),
                    title: Text(
                      'Public Marketplace',
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: const Text(
                      'Allow other users to discover and inspect this skill.',
                    ),
                    contentPadding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: _loading ? null : _save,
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _isEdit ? 'Save Changes' : 'Create Skill',
                              style: AppTypography.labelLarge,
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  InputDecoration _decoration(
    bool isDark, {
    required String label,
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      alignLabelWithHint: true,
      filled: true,
      fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final notifier = ref.read(mySkillsProvider.notifier);
      final description = _descCtrl.text.trim();
      final instructions = _instructionsCtrl.text.trim();
      SkillModel saved;
      if (_isEdit) {
        saved = await notifier.editItem(
          widget.skillId!,
          name: _slug,
          description: description,
          instructions: instructions,
          isPublic: _isPublic,
        );
      } else {
        saved = await notifier.create(
          name: _slug,
          description: description,
          instructions: instructions,
          isPublic: _isPublic,
        );
      }
      if (mounted) context.go(RouteNames.skillDetailPath(saved.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_friendlyError(e))));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _friendlyError(Object error) {
    final text = error.toString();
    if (text.contains('already have') || text.contains('already exists')) {
      return 'A skill with this name already exists.';
    }
    return text;
  }

  String _slugify(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
  }
}
