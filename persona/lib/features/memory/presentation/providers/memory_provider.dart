import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/memory_remote_datasource.dart';
import '../../data/models/memory_model.dart';

final memoryDatasourceProvider = Provider<MemoryRemoteDatasource>(
  (ref) => MemoryRemoteDatasource(ref.read(dioClientProvider)),
);

class MemoryNotifier extends AsyncNotifier<AllMemoryDataModel> {
  @override
  Future<AllMemoryDataModel> build() async {
    final resp = await ref.read(memoryDatasourceProvider).getAllMemory();
    return resp.data ??
        const AllMemoryDataModel(
          userFiles: [],
          agentMemories: [],
        );
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
  }

  Future<void> createFile({
    String scope = 'user',
    String? agentId,
    required String path,
    required String content,
  }) async {
    final resp = await ref
        .read(memoryDatasourceProvider)
        .writeMemoryFile(scope: scope, agentId: agentId, path: path, content: content);
    final created = resp.data!;
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }

    if (created.scope == 'user') {
      state = AsyncData(
        AllMemoryDataModel(
          userFiles: [
            created,
            ...current.userFiles.where((f) => f.path != created.path),
          ],
          agentMemories: current.agentMemories,
        ),
      );
    } else {
      // agent-scoped
      final updatedGroups = current.agentMemories.map((g) {
        if (g.agentId == created.agentId) {
          return g.copyWith(
            files: [
              created,
              ...g.files.where((f) => f.path != created.path),
            ],
          );
        }
        return g;
      }).toList();

      if (!updatedGroups.any((g) => g.agentId == created.agentId)) {
        updatedGroups.add(
          AgentMemoryGroupModel(
            agentId: created.agentId!,
            agentName: created.agentId,
            files: [created],
          ),
        );
      }

      state = AsyncData(
        AllMemoryDataModel(
          userFiles: current.userFiles,
          agentMemories: updatedGroups,
        ),
      );
    }
  }

  Future<void> editFile({
    String scope = 'user',
    String? agentId,
    required String path,
    required String content,
  }) async {
    final resp = await ref
        .read(memoryDatasourceProvider)
        .writeMemoryFile(scope: scope, agentId: agentId, path: path, content: content);
    final updated = resp.data!;
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }

    if (updated.scope == 'user') {
      state = AsyncData(
        AllMemoryDataModel(
          userFiles: current.userFiles
              .map((f) => f.path == updated.path ? updated : f)
              .toList(),
          agentMemories: current.agentMemories,
        ),
      );
    } else {
      state = AsyncData(
        AllMemoryDataModel(
          userFiles: current.userFiles,
          agentMemories: current.agentMemories.map((g) {
            if (g.agentId == updated.agentId) {
              return g.copyWith(
                files: g.files
                    .map((f) => f.path == updated.path ? updated : f)
                    .toList(),
              );
            }
            return g;
          }).toList(),
        ),
      );
    }
  }

  Future<void> deleteFile({
    String scope = 'user',
    String? agentId,
    required String path,
  }) async {
    await ref
        .read(memoryDatasourceProvider)
        .deleteMemoryFile(scope: scope, agentId: agentId, path: path);
    final current = state.value;
    if (current == null) return;

    if (scope == 'user') {
      state = AsyncData(
        AllMemoryDataModel(
          userFiles: current.userFiles.where((f) => f.path != path).toList(),
          agentMemories: current.agentMemories,
        ),
      );
    } else {
      state = AsyncData(
        AllMemoryDataModel(
          userFiles: current.userFiles,
          agentMemories: current.agentMemories
              .map((g) {
                if (g.agentId == agentId) {
                  final remaining = g.files.where((f) => f.path != path).toList();
                  return remaining.isEmpty ? null : g.copyWith(files: remaining);
                }
                return g;
              })
              .whereType<AgentMemoryGroupModel>()
              .toList(),
        ),
      );
    }
  }

  Future<void> clearAll() async {
    await ref.read(memoryDatasourceProvider).clearAllMemory();
    state = const AsyncData(
      AllMemoryDataModel(userFiles: [], agentMemories: []),
    );
  }
}

final memoryProvider = AsyncNotifierProvider<MemoryNotifier, AllMemoryDataModel>(
  MemoryNotifier.new,
);
