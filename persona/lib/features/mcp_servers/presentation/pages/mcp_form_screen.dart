import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/app_top_bar.dart';
import '../providers/mcp_provider.dart';

class McpFormScreen extends ConsumerStatefulWidget {
  const McpFormScreen({super.key, this.mcpId});
  final String? mcpId;

  @override
  ConsumerState<McpFormScreen> createState() => _McpFormScreenState();
}

class _McpFormScreenState extends ConsumerState<McpFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final _apiKeyCtrl = TextEditingController();
  String _authType = 'none';
  bool _loading = false;
  bool _testing = false;
  String? _testResult;
  bool? _testSuccess;
  bool _obscureKey = true;

  bool get _isEdit => widget.mcpId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _urlCtrl.dispose();
    _apiKeyCtrl.dispose();
    super.dispose();
  }

  void _loadExisting() {
    final mcps = ref.read(mcpListProvider).value ?? [];
    final mcp =
        mcps.firstWhere((m) => m.id == widget.mcpId, orElse: () => mcps.first);
    _nameCtrl.text = mcp.name;
    _urlCtrl.text = mcp.serverUrl;
    _authType = mcp.authType;
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
            title: _isEdit ? 'Edit MCP Server' : 'Add MCP Server',
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
              _field(isDark,
                  controller: _nameCtrl,
                  label: 'Server Name',
                  hint: 'my-mcp',
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field(isDark,
                  controller: _urlCtrl,
                  label: 'Server URL',
                  hint: 'https://mcp.example.com',
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _authType,
                decoration: InputDecoration(
                  labelText: 'Authentication',
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
                  DropdownMenuItem(value: 'none', child: Text('None')),
                  DropdownMenuItem(value: 'apiKey', child: Text('API Key')),
                  DropdownMenuItem(value: 'oauth', child: Text('OAuth')),
                ],
                onChanged: (v) => setState(() => _authType = v ?? 'none'),
              ),
              if (_authType == 'apiKey') ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _apiKeyCtrl,
                  obscureText: _obscureKey,
                  decoration: InputDecoration(
                    labelText: 'API Key',
                    filled: true,
                    fillColor: isDark
                        ? AppColors.inputFillDark
                        : AppColors.inputFillLight,
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
                ),
              ],
              if (_authType == 'oauth') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: AppColors.info.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline_rounded,
                          size: 16, color: AppColors.info),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Save this server first, then use the Authorize button to complete OAuth.',
                          style: AppTypography.bodySmall
                              .copyWith(color: AppColors.info),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (_isEdit) ...[
                OutlinedButton.icon(
                  onPressed: _testing ? null : _test,
                  icon: _testing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
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
              ],
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
                  : Text(_isEdit ? 'Save Changes' : 'Add Server',
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

  Future<void> _test() async {
    if (!_isEdit) return;
    setState(() {
      _testing = true;
      _testResult = null;
    });
    try {
      final ok = await ref.read(mcpListProvider.notifier).test(widget.mcpId!);
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
      final notifier = ref.read(mcpListProvider.notifier);
      if (_isEdit) {
        await notifier.editItem(
          widget.mcpId!,
          name: _nameCtrl.text.trim(),
          serverUrl: _urlCtrl.text.trim(),
          authType: _authType,
          apiKey: _authType == 'apiKey' && _apiKeyCtrl.text.isNotEmpty
              ? _apiKeyCtrl.text
              : null,
        );
      } else {
        await notifier.create(
          name: _nameCtrl.text.trim(),
          serverUrl: _urlCtrl.text.trim(),
          authType: _authType,
          apiKey: _authType == 'apiKey' ? _apiKeyCtrl.text : null,
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
        title: const Text('Delete MCP server?'),
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
    await ref.read(mcpListProvider.notifier).delete(widget.mcpId!);
    if (mounted) context.pop();
  }
}
