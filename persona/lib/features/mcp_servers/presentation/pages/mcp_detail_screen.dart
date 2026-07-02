import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/mcp_model.dart';
import '../providers/mcp_provider.dart';

class McpDetailScreen extends ConsumerStatefulWidget {
  const McpDetailScreen({super.key, required this.mcpId});

  final String mcpId;

  @override
  ConsumerState<McpDetailScreen> createState() => _McpDetailScreenState();
}

class _McpDetailScreenState extends ConsumerState<McpDetailScreen> {
  bool _testing = false;
  bool _oauthBusy = false;

  @override
  Widget build(BuildContext context) {
    final mcpAsync = ref.watch(mcpDetailProvider(widget.mcpId));
    final agentsAsync = ref.watch(mcpAgentsProvider(widget.mcpId));

    return ConnectorPageScaffold(
      title: 'MCP Server',
      section: ConnectorSection.mcps,
      child: mcpAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(mcpDetailProvider(widget.mcpId).future),
        ),
        data: (mcp) => ConnectorScrollableContent(
          maxWidth: 1040,
          children: [
            ConnectorIntro(
              title: mcp.name,
              description: mcp.description.isEmpty ? mcp.url : mcp.description,
              trailing: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _testConnection(mcp),
                    icon: _testing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.network_check_rounded, size: 18),
                    label: const Text('Test'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () =>
                        context.push(RouteNames.mcpEditPath(mcp.id)),
                    icon: const Icon(Icons.tune_rounded, size: 18),
                    label: const Text('Configure'),
                  ),
                  FilledButton.icon(
                    onPressed: () => _deleteMcp(
                      context,
                      ref,
                      mcp.id,
                      agentsAsync.value ?? [],
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.error,
                    ),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Remove'),
                  ),
                ],
              ),
            ),
            DetailCard(
              child: Row(
                children: [
                  ConnectorBadge(
                    label: mcp.isEnabled ? 'Enabled' : 'Disabled',
                    color: mcp.isEnabled
                        ? AppColors.success
                        : AppColors.textSecondaryLight,
                  ),
                  const SizedBox(width: 8),
                  ConnectorBadge(
                    label: mcp.transport.toUpperCase(),
                    color: ConnectorSection.mcps.color,
                  ),
                  const SizedBox(width: 8),
                  ConnectorBadge(label: _authLabel(mcp), color: AppColors.info),
                  const Spacer(),
                  Text('Enabled', style: AppTypography.labelMedium),
                  Switch(
                    value: mcp.isEnabled,
                    onChanged: (_) => _toggleEnabled(mcp),
                  ),
                ],
              ),
            ),
            if (mcp.authType == 'oauth') ...[
              const SizedBox(height: 14),
              _OAuthCard(
                mcp: mcp,
                oauthBusy: _oauthBusy,
                onConnectOwner: () => _openOwnerOAuth(mcp),
                onConnectUser: () => _openUserOAuth(mcp),
                onDisconnectOwner: () => _disconnectOwner(mcp),
                onDisconnectUser: () => _disconnectUser(mcp),
              ),
            ],
            const SizedBox(height: 14),
            _CapabilityListCard(
              title: 'Tools',
              emptyText: 'No tools discovered yet. Test the connection.',
              items: mcp.tools
                  .map(
                    (tool) => _CapabilityItem(
                      title: tool.name,
                      subtitle: tool.description,
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 14),
            _CapabilityListCard(
              title: 'Resources',
              emptyText: 'No resources discovered yet.',
              items: [
                ...mcp.resources.map(
                  (resource) => _CapabilityItem(
                    title: resource.name.isEmpty ? resource.uri : resource.name,
                    subtitle: resource.description.isEmpty
                        ? resource.mimeType
                        : resource.description,
                  ),
                ),
                ...mcp.resourceTemplates.map(
                  (template) => _CapabilityItem(
                    title: template.name.isEmpty
                        ? template.uriTemplate
                        : template.name,
                    subtitle: template.description.isEmpty
                        ? template.toolName
                        : template.description,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _UsedByAgentsCard(agentsAsync: agentsAsync),
            const SizedBox(height: 14),
            DetailCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Details', style: AppTypography.titleMedium),
                  const SizedBox(height: 8),
                  KeyValueRow(label: 'URL', value: mcp.url),
                  KeyValueRow(label: 'Transport', value: mcp.transport),
                  KeyValueRow(label: 'Auth type', value: _authLabel(mcp)),
                  KeyValueRow(label: 'Auth mode', value: mcp.authMode),
                  KeyValueRow(
                    label: 'Last tested',
                    value: _formatDate(mcp.lastTestedAt),
                  ),
                  KeyValueRow(
                    label: 'Updated',
                    value: _formatDate(mcp.updatedAt),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _testConnection(McpModel mcp) async {
    setState(() => _testing = true);
    try {
      final result = await ref.read(mcpListProvider.notifier).test(mcp.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Connected: ${result.tools.length} tools, ${result.resources.length} resources, ${result.resourceTemplates.length} templates.',
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Connection failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _toggleEnabled(McpModel mcp) async {
    try {
      await ref.read(mcpListProvider.notifier).toggleEnabled(mcp);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _openOwnerOAuth(McpModel mcp) async {
    await _openOAuthUrl(
      () => ref.read(mcpDatasourceProvider).getOwnerAuthorizeUrl(mcp.id),
    );
  }

  Future<void> _openUserOAuth(McpModel mcp) async {
    await _openOAuthUrl(
      () => ref.read(mcpDatasourceProvider).getUserAuthorizeUrl(mcp.id),
    );
  }

  Future<void> _openOAuthUrl(Future<dynamic> Function() requestUrl) async {
    setState(() => _oauthBusy = true);
    try {
      final response = await requestUrl();
      final url = response.data?.toString() ?? '';
      final uri = Uri.tryParse(url);
      if (uri == null) throw Exception('Authorization URL was empty');
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) throw Exception('Could not open authorization URL');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'OAuth opened in your browser. Return here to refresh.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('OAuth error: $e')));
      }
    } finally {
      if (mounted) setState(() => _oauthBusy = false);
    }
  }

  Future<void> _disconnectOwner(McpModel mcp) async {
    await _disconnectOAuth(
      () => ref.read(mcpDatasourceProvider).disconnectOwnerConnection(mcp.id),
      mcp.id,
    );
  }

  Future<void> _disconnectUser(McpModel mcp) async {
    await _disconnectOAuth(
      () => ref.read(mcpDatasourceProvider).disconnectUserConnection(mcp.id),
      mcp.id,
    );
  }

  Future<void> _disconnectOAuth(
    Future<void> Function() action,
    String mcpId,
  ) async {
    setState(() => _oauthBusy = true);
    try {
      await action();
      ref.invalidate(mcpDetailProvider(mcpId));
      ref.invalidate(mcpUserConnectionProvider(mcpId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('OAuth connection disconnected')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('OAuth error: $e')));
      }
    } finally {
      if (mounted) setState(() => _oauthBusy = false);
    }
  }

  Future<void> _deleteMcp(
    BuildContext context,
    WidgetRef ref,
    String id,
    List<AgentModel> agents,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove MCP server?'),
        content: Text(
          agents.isEmpty
              ? 'This action cannot be undone.'
              : 'This server is used by ${agents.length} agent${agents.length == 1 ? '' : 's'} and will be removed from them.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(mcpListProvider.notifier).delete(id);
      if (context.mounted) context.go(RouteNames.mcps);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  String _authLabel(McpModel mcp) {
    return switch (mcp.authType) {
      'apiKey' => 'API Key',
      'oauth' => 'OAuth',
      _ => 'None',
    };
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Never';
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }
}

class _OAuthCard extends ConsumerWidget {
  const _OAuthCard({
    required this.mcp,
    required this.oauthBusy,
    required this.onConnectOwner,
    required this.onConnectUser,
    required this.onDisconnectOwner,
    required this.onDisconnectUser,
  });

  final McpModel mcp;
  final bool oauthBusy;
  final VoidCallback onConnectOwner;
  final VoidCallback onConnectUser;
  final VoidCallback onDisconnectOwner;
  final VoidCallback onDisconnectUser;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userStatus = mcp.authMode == 'user'
        ? ref.watch(mcpUserConnectionProvider(mcp.id))
        : const AsyncValue<bool>.data(false);
    final connected = mcp.authMode == 'owner'
        ? mcp.ownerOauthConnected
        : userStatus.value ?? false;

    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('OAuth', style: AppTypography.titleMedium),
              const Spacer(),
              ConnectorBadge(
                label: connected ? 'Connected' : 'Not Connected',
                color: connected ? AppColors.success : AppColors.warning,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Authorization opens in an external browser. After completing the flow, return here and refresh the server.',
            style: AppTypography.bodySmall,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: oauthBusy
                    ? null
                    : mcp.authMode == 'owner'
                    ? onConnectOwner
                    : onConnectUser,
                icon: const Icon(Icons.open_in_browser_rounded, size: 18),
                label: Text(connected ? 'Reconnect' : 'Connect'),
              ),
              if (connected)
                OutlinedButton.icon(
                  onPressed: oauthBusy
                      ? null
                      : mcp.authMode == 'owner'
                      ? onDisconnectOwner
                      : onDisconnectUser,
                  icon: const Icon(Icons.link_off_rounded, size: 18),
                  label: const Text('Disconnect'),
                ),
              if (mcp.authMode == 'user')
                OutlinedButton.icon(
                  onPressed: () =>
                      ref.invalidate(mcpUserConnectionProvider(mcp.id)),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Refresh Status'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CapabilityListCard extends StatelessWidget {
  const _CapabilityListCard({
    required this.title,
    required this.emptyText,
    required this.items,
  });

  final String title;
  final String emptyText;
  final List<_CapabilityItem> items;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.titleMedium),
          const SizedBox(height: 10),
          if (items.isEmpty)
            Text(emptyText, style: AppTypography.bodySmall)
          else
            ...items,
        ],
      ),
    );
  }
}

class _CapabilityItem extends StatelessWidget {
  const _CapabilityItem({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.chevron_right_rounded,
            size: 18,
            color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title.isEmpty ? 'Unnamed capability' : title,
                  style: AppTypography.labelLarge.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTypography.bodySmall.copyWith(
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _UsedByAgentsCard extends StatelessWidget {
  const _UsedByAgentsCard({required this.agentsAsync});

  final AsyncValue<List<AgentModel>> agentsAsync;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Used by Agents', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          agentsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(
              e.toString(),
              style: AppTypography.bodySmall.copyWith(color: AppColors.error),
            ),
            data: (agents) => agents.isEmpty
                ? Text(
                    'No agents are using this server.',
                    style: AppTypography.bodySmall,
                  )
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: agents
                        .map(
                          (agent) => Chip(
                            avatar: const Icon(Icons.smart_toy_outlined),
                            label: Text(agent.name),
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
