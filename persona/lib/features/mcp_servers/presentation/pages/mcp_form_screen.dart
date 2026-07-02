import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/mcp_model.dart';
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
  final _descCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final _apiKeyCtrl = TextEditingController();
  final _clientIdCtrl = TextEditingController();
  final _clientSecretCtrl = TextEditingController();
  final _scopesCtrl = TextEditingController();

  String _transport = 'http';
  String _authType = 'none';
  String _authMode = 'owner';
  bool _useDcr = true;
  bool _obscureApiKey = true;
  bool _obscureSecret = true;
  bool _loading = false;
  bool _loadingExisting = false;
  String? _loadError;
  McpModel? _existing;

  bool get _isEdit => widget.mcpId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _urlCtrl.dispose();
    _apiKeyCtrl.dispose();
    _clientIdCtrl.dispose();
    _clientSecretCtrl.dispose();
    _scopesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadExisting() async {
    setState(() {
      _loadingExisting = true;
      _loadError = null;
    });
    try {
      McpModel? mcp;
      for (final item in ref.read(mcpListProvider).value ?? <McpModel>[]) {
        if (item.id == widget.mcpId) {
          mcp = item;
          break;
        }
      }
      mcp ??= (await ref.read(mcpDatasourceProvider).getMcpById(widget.mcpId!))
          .data;
      if (!mounted || mcp == null) return;
      _nameCtrl.text = mcp.name;
      _descCtrl.text = mcp.description;
      _urlCtrl.text = mcp.url;
      _clientIdCtrl.text = mcp.oauth.clientId ?? '';
      _scopesCtrl.text = mcp.oauth.scopes.join(' ');
      setState(() {
        _existing = mcp;
        _transport = mcp!.transport;
        _authType = mcp.authType;
        _authMode = mcp.authMode;
        _useDcr = mcp.oauth.dynamicallyRegistered;
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
      title: _isEdit ? 'Configure MCP' : 'Add MCP Server',
      section: ConnectorSection.mcps,
      child: _loadingExisting
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? ErrorState(message: _loadError!, onRetry: _loadExisting)
          : Form(
              key: _formKey,
              child: ConnectorScrollableContent(
                maxWidth: 820,
                children: [
                  ConnectorIntro(
                    title: _isEdit ? 'Configure Server' : 'Connect Server',
                    description:
                        'Add an MCP endpoint and choose how agents authenticate with it.',
                  ),
                  TextFormField(
                    controller: _nameCtrl,
                    maxLength: 100,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.length < 2) {
                        return 'Name must be at least 2 characters';
                      }
                      return null;
                    },
                    decoration: _decoration(
                      isDark,
                      label: 'Name',
                      hint: 'Canva MCP',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descCtrl,
                    minLines: 2,
                    maxLines: 4,
                    maxLength: 500,
                    decoration: _decoration(
                      isDark,
                      label: 'Description',
                      hint: 'External creative tools and resources.',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _urlCtrl,
                    keyboardType: TextInputType.url,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      final uri = Uri.tryParse(text);
                      if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
                        return 'Enter a valid URL';
                      }
                      return null;
                    },
                    decoration: _decoration(
                      isDark,
                      label: 'Server URL',
                      hint: 'https://mcp.example.com',
                    ),
                  ),
                  const SizedBox(height: 18),
                  _SectionTitle('Transport'),
                  const SizedBox(height: 8),
                  _SelectGrid(
                    children: [
                      _SelectCard(
                        selected: _transport == 'http',
                        icon: Icons.http_rounded,
                        title: 'HTTP',
                        subtitle: 'Streamable HTTP',
                        onTap: () => setState(() => _transport = 'http'),
                      ),
                      _SelectCard(
                        selected: _transport == 'sse',
                        icon: Icons.sync_alt_rounded,
                        title: 'SSE',
                        subtitle: 'Server-sent events',
                        onTap: () => setState(() => _transport = 'sse'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _SectionTitle('Authentication'),
                  const SizedBox(height: 8),
                  _SelectGrid(
                    children: [
                      _SelectCard(
                        selected: _authType == 'none',
                        icon: Icons.lock_open_rounded,
                        title: 'None',
                        subtitle: 'No credentials',
                        onTap: () => setState(() => _authType = 'none'),
                      ),
                      _SelectCard(
                        selected: _authType == 'oauth',
                        icon: Icons.verified_user_rounded,
                        title: 'OAuth',
                        subtitle: 'Owner or per-user',
                        onTap: () => setState(() => _authType = 'oauth'),
                      ),
                      _SelectCard(
                        selected: _authType == 'apiKey',
                        icon: Icons.key_rounded,
                        title: 'API Key',
                        subtitle: 'Bearer token',
                        onTap: () => setState(() => _authType = 'apiKey'),
                      ),
                    ],
                  ),
                  if (_authType != 'none') ...[
                    const SizedBox(height: 18),
                    _SectionTitle('Auth Mode'),
                    const SizedBox(height: 8),
                    _SelectGrid(
                      children: [
                        _SelectCard(
                          selected: _authMode == 'owner',
                          icon: Icons.admin_panel_settings_rounded,
                          title: 'Owner',
                          subtitle: 'Shared by you',
                          onTap: () => setState(() => _authMode = 'owner'),
                        ),
                        _SelectCard(
                          selected: _authMode == 'user',
                          icon: Icons.person_rounded,
                          title: 'User',
                          subtitle: 'Each user connects',
                          onTap: () => setState(() => _authMode = 'user'),
                        ),
                      ],
                    ),
                  ],
                  if (_authType == 'apiKey') ...[
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _apiKeyCtrl,
                      obscureText: _obscureApiKey,
                      validator: (value) {
                        final hasExisting = _existing?.hasApiKey ?? false;
                        if (!_isEdit && (value?.trim().isEmpty ?? true)) {
                          return 'API key is required';
                        }
                        if (_isEdit &&
                            !hasExisting &&
                            (value?.trim().isEmpty ?? true)) {
                          return 'API key is required';
                        }
                        return null;
                      },
                      decoration: _decoration(
                        isDark,
                        label: 'API Key',
                        hint: _isEdit
                            ? 'Leave blank to keep current'
                            : 'sk-mcp...',
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _obscureApiKey = !_obscureApiKey),
                          icon: Icon(
                            _obscureApiKey
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (_authType == 'oauth') ...[
                    const SizedBox(height: 16),
                    if (!_isEdit)
                      CheckboxListTile(
                        value: _useDcr,
                        onChanged: (value) =>
                            setState(() => _useDcr = value ?? true),
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Auto-register OAuth client'),
                        subtitle: const Text(
                          'Use Dynamic Client Registration when the server supports it.',
                        ),
                      ),
                    if (!_useDcr || _isEdit) ...[
                      TextFormField(
                        controller: _clientIdCtrl,
                        validator: (value) {
                          if (_useDcr && !_isEdit) return null;
                          final hasExisting =
                              (_existing?.oauth.clientId ?? '').isNotEmpty;
                          if (!hasExisting && (value?.trim().isEmpty ?? true)) {
                            return 'Client ID is required';
                          }
                          return null;
                        },
                        decoration: _decoration(
                          isDark,
                          label: 'Client ID',
                          hint: _isEdit
                              ? 'Leave blank to keep current'
                              : 'mcp-client-id',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _clientSecretCtrl,
                        obscureText: _obscureSecret,
                        validator: (value) {
                          if (_useDcr && !_isEdit) return null;
                          final hasExisting =
                              _existing?.oauth.hasClientSecret ?? false;
                          if (!hasExisting && (value?.trim().isEmpty ?? true)) {
                            return 'Client Secret is required';
                          }
                          return null;
                        },
                        decoration: _decoration(
                          isDark,
                          label: 'Client Secret',
                          hint: _isEdit
                              ? 'Leave blank to keep current'
                              : 'client-secret',
                          suffixIcon: IconButton(
                            onPressed: () => setState(
                              () => _obscureSecret = !_obscureSecret,
                            ),
                            icon: Icon(
                              _obscureSecret
                                  ? Icons.visibility_off_rounded
                                  : Icons.visibility_rounded,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _scopesCtrl,
                        decoration: _decoration(
                          isDark,
                          label: 'Scopes',
                          hint: 'openid profile tools.read',
                        ),
                      ),
                    ],
                  ],
                  const SizedBox(height: 22),
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
                              _isEdit ? 'Save Changes' : 'Add Server',
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
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      suffixIcon: suffixIcon,
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
      final scopes = _scopesCtrl.text
          .split(RegExp(r'\s+|,'))
          .map((scope) => scope.trim())
          .where((scope) => scope.isNotEmpty)
          .toList();
      final notifier = ref.read(mcpListProvider.notifier);
      McpModel saved;
      if (_isEdit) {
        saved = await notifier.editItem(
          widget.mcpId!,
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          transport: _transport,
          url: _urlCtrl.text.trim(),
          authType: _authType,
          authMode: _authMode,
          apiKey: _apiKeyCtrl.text.trim().isEmpty
              ? null
              : _apiKeyCtrl.text.trim(),
          useDynamicRegistration: _authType == 'oauth' ? _useDcr : null,
          oauthClientId: _clientIdCtrl.text.trim().isEmpty
              ? null
              : _clientIdCtrl.text.trim(),
          oauthClientSecret: _clientSecretCtrl.text.trim().isEmpty
              ? null
              : _clientSecretCtrl.text.trim(),
          scopes: scopes.isEmpty ? null : scopes,
        );
      } else {
        saved = await notifier.create(
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          transport: _transport,
          url: _urlCtrl.text.trim(),
          authType: _authType,
          authMode: _authMode,
          apiKey: _authType == 'apiKey' ? _apiKeyCtrl.text.trim() : null,
          useDynamicRegistration: _authType == 'oauth' && _useDcr,
          oauthClientId: _clientIdCtrl.text.trim().isEmpty
              ? null
              : _clientIdCtrl.text.trim(),
          oauthClientSecret: _clientSecretCtrl.text.trim().isEmpty
              ? null
              : _clientSecretCtrl.text.trim(),
          scopes: scopes,
        );
      }
      if (mounted) context.go(RouteNames.mcpDetailPath(saved.id));
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
    if (text.contains('already')) {
      return 'An MCP server with this name already exists.';
    }
    return text;
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

class _SelectGrid extends StatelessWidget {
  const _SelectGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 560;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: children
              .map(
                (child) => SizedBox(
                  width: isNarrow
                      ? constraints.maxWidth
                      : (constraints.maxWidth - 20) / 3,
                  child: child,
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _SelectCard extends StatelessWidget {
  const _SelectCard({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final active = isDark ? AppColors.primaryDark : AppColors.primaryLight;
    return Material(
      color: selected
          ? active.withValues(alpha: 0.1)
          : isDark
          ? AppColors.cardDark
          : AppColors.cardLight,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: selected
                  ? active
                  : isDark
                  ? AppColors.dividerDark
                  : AppColors.dividerLight,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, color: selected ? active : null),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.labelLarge.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodySmall.copyWith(
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                      ),
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
}
