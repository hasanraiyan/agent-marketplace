import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
import '../../data/datasources/mcp_remote_datasource.dart';
import '../../data/models/mcp_model.dart';

final mcpDatasourceProvider = Provider<McpRemoteDatasource>(
  (ref) => McpRemoteDatasource(ref.read(dioClientProvider)),
);

class McpListNotifier extends AsyncNotifier<List<McpModel>> {
  @override
  Future<List<McpModel>> build() async {
    final resp = await ref.read(mcpDatasourceProvider).getMcps();
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(mcpListProvider.future);

  Future<McpModel> create({
    required String name,
    required String description,
    required String transport,
    required String url,
    required String authType,
    required String authMode,
    String? apiKey,
    bool useDynamicRegistration = false,
    String? oauthClientId,
    String? oauthClientSecret,
    List<String> scopes = const [],
  }) async {
    final resp = await ref
        .read(mcpDatasourceProvider)
        .createMcp(
          name: name,
          description: description,
          transport: transport,
          url: url,
          authType: authType,
          authMode: authMode,
          apiKey: apiKey,
          useDynamicRegistration: useDynamicRegistration,
          oauthClientId: oauthClientId,
          oauthClientSecret: oauthClientSecret,
          scopes: scopes,
        );
    final created = resp.data!;
    state = AsyncData([created, ...(state.value ?? [])]);
    return created;
  }

  Future<McpModel> editItem(
    String id, {
    String? name,
    String? description,
    String? transport,
    String? url,
    String? authType,
    String? authMode,
    bool? isEnabled,
    String? apiKey,
    bool? useDynamicRegistration,
    String? oauthClientId,
    String? oauthClientSecret,
    List<String>? scopes,
  }) async {
    final resp = await ref
        .read(mcpDatasourceProvider)
        .updateMcp(
          id,
          name: name,
          description: description,
          transport: transport,
          url: url,
          authType: authType,
          authMode: authMode,
          isEnabled: isEnabled,
          apiKey: apiKey,
          useDynamicRegistration: useDynamicRegistration,
          oauthClientId: oauthClientId,
          oauthClientSecret: oauthClientSecret,
          scopes: scopes,
        );
    final updated = resp.data!;
    state = AsyncData(
      (state.value ?? []).map((m) => m.id == id ? updated : m).toList(),
    );
    ref.invalidate(mcpDetailProvider(id));
    return updated;
  }

  Future<void> delete(String id) async {
    await ref.read(mcpDatasourceProvider).deleteMcp(id);
    state = AsyncData((state.value ?? []).where((m) => m.id != id).toList());
    ref.invalidate(mcpDetailProvider(id));
  }

  Future<McpTestResult> test(String id) async {
    final resp = await ref.read(mcpDatasourceProvider).testMcp(id);
    ref.invalidate(mcpDetailProvider(id));
    ref.invalidateSelf();
    return resp.data!;
  }

  Future<void> toggleEnabled(McpModel mcp) async {
    await editItem(mcp.id, isEnabled: !mcp.isEnabled);
  }
}

final mcpListProvider = AsyncNotifierProvider<McpListNotifier, List<McpModel>>(
  McpListNotifier.new,
);

class McpDetailNotifier extends AsyncNotifier<McpModel> {
  McpDetailNotifier(this._mcpId);

  final String _mcpId;

  @override
  Future<McpModel> build() async {
    for (final mcp in ref.read(mcpListProvider).value ?? <McpModel>[]) {
      if (mcp.id == _mcpId) return mcp;
    }
    final resp = await ref.read(mcpDatasourceProvider).getMcpById(_mcpId);
    return resp.data!;
  }
}

final mcpDetailProvider =
    AsyncNotifierProvider.family<McpDetailNotifier, McpModel, String>(
      McpDetailNotifier.new,
    );

final mcpAgentsProvider = FutureProvider.family<List<AgentModel>, String>((
  ref,
  mcpId,
) async {
  final resp = await ref.read(mcpDatasourceProvider).getUsedByAgents(mcpId);
  return resp.data ?? [];
});

final mcpUserConnectionProvider = FutureProvider.family<bool, String>((
  ref,
  mcpId,
) async {
  final resp = await ref
      .read(mcpDatasourceProvider)
      .getUserConnectionStatus(mcpId);
  return resp.data ?? false;
});
