import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../providers/provider_notifier.dart';

const _presets = [
  _ProviderPreset('OpenAI', 'https://api.openai.com/v1'),
  _ProviderPreset('Anthropic', 'https://api.anthropic.com'),
  _ProviderPreset('Google AI', 'https://generativelanguage.googleapis.com/v1beta'),
  _ProviderPreset('Groq', 'https://api.groq.com/openai/v1'),
];

class _ProviderPreset {
  const _ProviderPreset(this.name, this.url);
  final String name;
  final String url;
}

class ProviderFormScreen extends ConsumerStatefulWidget {
  const ProviderFormScreen({super.key, this.providerId});
  final String? providerId;

  @override
  ConsumerState<ProviderFormScreen> createState() => _ProviderFormScreenState();
}

class _ProviderFormScreenState extends ConsumerState<ProviderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _labelCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final _keyCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  bool _isDefault = false;
  bool _obscureKey = true;
  bool _loading = false;
  bool _testing = false;
  String? _testResult;
  bool? _testSuccess;

  bool get _isEdit => widget.providerId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _urlCtrl.dispose();
    _keyCtrl.dispose();
    _modelCtrl.dispose();
    super.dispose();
  }

  void _loadExisting() {
    final providers = ref.read(providerListProvider).value ?? [];
    final p = providers.firstWhere((p) => p.id == widget.providerId,
        orElse: () => providers.first);
    _labelCtrl.text = p.label;
    _urlCtrl.text = p.baseURL;
    _modelCtrl.text = p.defaultModel;
    _isDefault = p.isDefault;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          bottom: false,
          child: AppTopBar(
            title: _isEdit ? 'Edit Provider' : 'Add Provider',
            actions: _isEdit
                ? [
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded,
                          color: AppColors.error),
                      onPressed: _delete,
                    ),
                  ]
                : [],
          ),
        ),
      ),
      body: ResponsiveCenter(
        padding: EdgeInsets.symmetric(horizontal: r.horizontalPadding),
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(top: 8, bottom: 100),
            children: [
              // Preset buttons
              if (!_isEdit) ...[
                Text('Quick preset',
                    style: AppTypography.bodySmall.copyWith(
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    )),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: _presets.map((p) {
                    return ActionChip(
                      label: Text(p.name),
                      onPressed: () => setState(() => _urlCtrl.text = p.url),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
              ],

              _field(isDark,
                  controller: _labelCtrl,
                  label: 'Label',
                  hint: 'My OpenAI',
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field(isDark,
                  controller: _urlCtrl,
                  label: 'Base URL',
                  hint: 'https://api.openai.com/v1',
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              const SizedBox(height: 12),

              // API Key field with visibility toggle
              TextFormField(
                controller: _keyCtrl,
                obscureText: _obscureKey,
                decoration: InputDecoration(
                  labelText: _isEdit ? 'API Key (leave blank to keep)' : 'API Key',
                  filled: true,
                  fillColor:
                      isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureKey
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded),
                    onPressed: () =>
                        setState(() => _obscureKey = !_obscureKey),
                  ),
                ),
                validator: _isEdit
                    ? null
                    : (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              _field(isDark,
                  controller: _modelCtrl,
                  label: 'Default Model',
                  hint: 'gpt-4o'),
              const SizedBox(height: 8),
              SwitchListTile(
                value: _isDefault,
                onChanged: (v) => setState(() => _isDefault = v),
                title: Text('Set as default provider',
                    style: AppTypography.bodyMedium),
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 16),

              // Test connection
              OutlinedButton.icon(
                onPressed: _testing ? null : _testConnection,
                icon: _testing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child:
                            CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.network_check_rounded),
                label: const Text('Test Connection'),
              ),
              if (_testResult != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: (_testSuccess == true
                            ? AppColors.success
                            : AppColors.error)
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _testResult!,
                    style: AppTypography.bodySmall.copyWith(
                      color: _testSuccess == true
                          ? AppColors.success
                          : AppColors.error,
                    ),
                  ),
                ),
              ],
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
                  : Text(_isEdit ? 'Save Changes' : 'Add Provider',
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
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
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

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _testResult = null;
    });
    try {
      final ok = await ref.read(providerListProvider.notifier).testConnection(
            label: _labelCtrl.text,
            baseURL: _urlCtrl.text,
            apiKey: _keyCtrl.text,
          );
      setState(() {
        _testSuccess = ok;
        _testResult = ok ? 'Connection successful!' : 'Connection failed.';
      });
    } catch (e) {
      setState(() {
        _testSuccess = false;
        _testResult = 'Error: $e';
      });
    } finally {
      setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final notifier = ref.read(providerListProvider.notifier);
      if (_isEdit) {
        await notifier.editItem(
          widget.providerId!,
          label: _labelCtrl.text.trim(),
          baseURL: _urlCtrl.text.trim(),
          apiKey: _keyCtrl.text.isNotEmpty ? _keyCtrl.text : null,
          defaultModel: _modelCtrl.text.trim(),
          isDefault: _isDefault,
        );
      } else {
        await notifier.create(
          label: _labelCtrl.text.trim(),
          baseURL: _urlCtrl.text.trim(),
          apiKey: _keyCtrl.text.trim(),
          defaultModel: _modelCtrl.text.trim(),
          isDefault: _isDefault,
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
        title: const Text('Delete provider?'),
        content: const Text('This will also affect agents using this provider.'),
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
    await ref.read(providerListProvider.notifier).delete(widget.providerId!);
    if (mounted) context.pop();
  }
}
