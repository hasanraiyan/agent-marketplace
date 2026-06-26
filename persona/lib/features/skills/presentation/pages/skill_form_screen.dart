import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
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
  final _codeCtrl = TextEditingController();
  String _language = 'python';
  bool _isPublic = false;
  bool _loading = false;

  bool get _isEdit => widget.skillId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  void _loadExisting() {
    final skills = ref.read(mySkillsProvider).value ?? [];
    final skill = skills.firstWhere((s) => s.id == widget.skillId,
        orElse: () => skills.first);
    _nameCtrl.text = skill.name;
    _descCtrl.text = skill.description;
    _isPublic = skill.isPublic;
    if (skill.codeSnippets.isNotEmpty) {
      _codeCtrl.text = skill.codeSnippets.first.code;
      _language = skill.codeSnippets.first.language;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Skill' : 'New Skill'),
        backgroundColor:
            isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        surfaceTintColor: Colors.transparent,
        actions: _isEdit
            ? [
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded,
                      color: AppColors.error),
                  onPressed: _delete,
                ),
              ]
            : null,
      ),
      body: ResponsiveCenter(
        padding: EdgeInsets.symmetric(horizontal: r.horizontalPadding),
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(top: 8, bottom: 100),
            children: [
              _field(isDark,
                  controller: _nameCtrl,
                  label: 'Skill Name',
                  hint: 'search_web',
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field(isDark,
                  controller: _descCtrl,
                  label: 'Description',
                  hint: 'Searches the web for current information',
                  maxLines: 2),
              const SizedBox(height: 12),

              // Language picker
              DropdownButtonFormField<String>(
                initialValue: _language,
                decoration: InputDecoration(
                  labelText: 'Language',
                  filled: true,
                  fillColor: isDark
                      ? AppColors.inputFillDark
                      : AppColors.inputFillLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'python', child: Text('Python')),
                  DropdownMenuItem(
                      value: 'typescript', child: Text('TypeScript')),
                  DropdownMenuItem(
                      value: 'javascript', child: Text('JavaScript')),
                ],
                onChanged: (v) => setState(() => _language = v ?? 'python'),
              ),
              const SizedBox(height: 12),

              // Code editor
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Code',
                    style: AppTypography.bodySmall.copyWith(
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF1a1a2e)
                          : const Color(0xFFF0F0F0),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: TextFormField(
                      controller: _codeCtrl,
                      maxLines: null,
                      minLines: 12,
                      style: AppTypography.mono.copyWith(
                        fontSize: 12.5,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.all(12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                value: _isPublic,
                onChanged: (v) => setState(() => _isPublic = v),
                title: Text('Make public', style: AppTypography.bodyMedium),
                subtitle: const Text('Share with the community'),
                contentPadding: EdgeInsets.zero,
              ),
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
                backgroundColor:
                    isDark ? AppColors.primaryDark : AppColors.primaryLight,
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
                  : Text(_isEdit ? 'Save Changes' : 'Create Skill',
                      style: AppTypography.labelLarge),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    bool isDark, {
    required TextEditingController controller,
    required String label,
    String? hint,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final notifier = ref.read(mySkillsProvider.notifier);
      final snippet = {
        'filename': 'main.${_language == 'python' ? 'py' : _language == 'typescript' ? 'ts' : 'js'}',
        'code': _codeCtrl.text,
        'language': _language,
      };
      if (_isEdit) {
        await notifier.editItem(
          widget.skillId!,
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          instructions: _descCtrl.text.trim(),
          isPublic: _isPublic,
          codeSnippets: [snippet],
        );
      } else {
        await notifier.create(
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          instructions: _descCtrl.text.trim(),
          isPublic: _isPublic,
          codeSnippets: [snippet],
        );
      }
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

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete skill?'),
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
    await ref.read(mySkillsProvider.notifier).delete(widget.skillId!);
    if (mounted) context.pop();
  }
}
