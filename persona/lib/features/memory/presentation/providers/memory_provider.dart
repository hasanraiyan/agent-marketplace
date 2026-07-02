import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/memory_remote_datasource.dart';
import '../../data/models/memory_model.dart';

final memoryDatasourceProvider = Provider<MemoryRemoteDatasource>(
  (ref) => MemoryRemoteDatasource(ref.read(dioClientProvider)),
);

class MemoryNotifier extends AsyncNotifier<MemoryDataModel> {
  @override
  Future<MemoryDataModel> build() async {
    final resp = await ref.read(memoryDatasourceProvider).getAllMemory();
    return resp.data ??
        MemoryDataModel(
          profile: MemoryProfileModel.fromJson(const {}),
          agentMemories: const [],
        );
  }

  Future<void> refresh() => ref.refresh(memoryProvider.future);

  Future<void> create({
    required String agentId,
    required String key,
    required String value,
  }) async {
    final resp = await ref
        .read(memoryDatasourceProvider)
        .createMemory(agentId: agentId, key: key, value: value);
    final created = resp.data!;
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }
    final withoutDuplicate = current.agentMemories.where(
      (entry) => entry.agentId != agentId || entry.key != key,
    );
    state = AsyncData(
      MemoryDataModel(
        profile: current.profile,
        agentMemories: [created, ...withoutDuplicate],
      ),
    );
  }

  Future<void> editItem({
    required String agentId,
    required String key,
    required String value,
  }) async {
    final resp = await ref
        .read(memoryDatasourceProvider)
        .updateMemory(agentId: agentId, key: key, value: value);
    final updated = resp.data!;
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }
    state = AsyncData(
      MemoryDataModel(
        profile: current.profile,
        agentMemories: current.agentMemories
            .map(
              (entry) => entry.agentId == agentId && entry.key == key
                  ? updated
                  : entry,
            )
            .toList(),
      ),
    );
  }

  Future<void> delete({required String agentId, required String key}) async {
    await ref
        .read(memoryDatasourceProvider)
        .deleteMemory(agentId: agentId, key: key);
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      MemoryDataModel(
        profile: current.profile,
        agentMemories: current.agentMemories
            .where((entry) => entry.agentId != agentId || entry.key != key)
            .toList(),
      ),
    );
  }

  Future<void> clearAll() async {
    await ref.read(memoryDatasourceProvider).clearAllMemory();
    state = AsyncData(
      MemoryDataModel(
        profile: MemoryProfileModel.fromJson(const {}),
        agentMemories: const [],
      ),
    );
  }
}

final memoryProvider = AsyncNotifierProvider<MemoryNotifier, MemoryDataModel>(
  MemoryNotifier.new,
);
