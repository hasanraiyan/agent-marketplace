import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/provider_remote_datasource.dart';
import '../../data/models/provider_model.dart';

final providerDatasourceProvider = Provider<ProviderRemoteDatasource>(
  (ref) => ProviderRemoteDatasource(ref.read(dioClientProvider)),
);

class ProviderListNotifier extends AsyncNotifier<List<ProviderModel>> {
  @override
  Future<List<ProviderModel>> build() async {
    final resp = await ref.read(providerDatasourceProvider).getProviders();
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(providerListProvider.future);

  Future<void> create({
    required String label,
    required String baseURL,
    required String apiKey,
    required String defaultModel,
    bool? isDefault,
  }) async {
    final resp = await ref.read(providerDatasourceProvider).createProvider(
          label: label,
          baseURL: baseURL,
          apiKey: apiKey,
          defaultModel: defaultModel,
          isDefault: isDefault,
        );
    final created = resp.data!;
    final current = state.value ?? [];
    final updated = isDefault == true
        ? [created, ...current.map((p) => _clearDefault(p))]
        : [created, ...current];
    state = AsyncData(updated);
  }

  Future<void> editItem(
    String id, {
    String? label,
    String? baseURL,
    String? apiKey,
    String? defaultModel,
    bool? isDefault,
  }) async {
    final resp = await ref.read(providerDatasourceProvider).updateProvider(
          id,
          label: label,
          baseURL: baseURL,
          apiKey: apiKey,
          defaultModel: defaultModel,
          isDefault: isDefault,
        );
    final updated = resp.data!;
    final current = state.value ?? [];
    state = AsyncData(
      current.map((p) {
        if (p.id == id) return updated;
        if (isDefault == true) return _clearDefault(p);
        return p;
      }).toList(),
    );
  }

  Future<void> delete(String id) async {
    await ref.read(providerDatasourceProvider).deleteProvider(id);
    state = AsyncData(
      (state.value ?? []).where((p) => p.id != id).toList(),
    );
  }

  Future<bool> testConnection({
    required String label,
    required String baseURL,
    required String apiKey,
  }) async {
    final resp = await ref.read(providerDatasourceProvider).testConnection(
          label: label,
          baseURL: baseURL,
          apiKey: apiKey,
        );
    return resp.data ?? false;
  }

  Future<List<String>> getModels(String id) async {
    final resp =
        await ref.read(providerDatasourceProvider).getProviderModels(id);
    return resp.data ?? [];
  }

  static ProviderModel _clearDefault(ProviderModel p) {
    return ProviderModel(
      id: p.id,
      ownerId: p.ownerId,
      label: p.label,
      baseURL: p.baseURL,
      defaultModel: p.defaultModel,
      isDefault: false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    );
  }
}

final providerListProvider =
    AsyncNotifierProvider<ProviderListNotifier, List<ProviderModel>>(
  ProviderListNotifier.new,
);
