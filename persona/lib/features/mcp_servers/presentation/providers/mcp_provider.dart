import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
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

  Future<void> create({
    required String name,
    required String serverUrl,
    required String authType,
    String? apiKey,
  }) async {
    final resp = await ref.read(mcpDatasourceProvider).createMcp(
          name: name,
          serverUrl: serverUrl,
          authType: authType,
          apiKey: apiKey,
        );
    state = AsyncData([resp.data!, ...(state.value ?? [])]);
  }

  Future<void> editItem(
    String id, {
    String? name,
    String? serverUrl,
    String? authType,
    String? apiKey,
  }) async {
    final resp = await ref.read(mcpDatasourceProvider).updateMcp(
          id,
          name: name,
          serverUrl: serverUrl,
          authType: authType,
          apiKey: apiKey,
        );
    state = AsyncData(
      (state.value ?? []).map((m) => m.id == id ? resp.data! : m).toList(),
    );
  }

  Future<void> delete(String id) async {
    await ref.read(mcpDatasourceProvider).deleteMcp(id);
    state = AsyncData(
      (state.value ?? []).where((m) => m.id != id).toList(),
    );
  }

  Future<bool> test(String id) async {
    final resp = await ref.read(mcpDatasourceProvider).testMcp(id);
    return resp.data ?? false;
  }
}

final mcpListProvider =
    AsyncNotifierProvider<McpListNotifier, List<McpModel>>(
  McpListNotifier.new,
);
