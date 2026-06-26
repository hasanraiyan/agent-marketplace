import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/thread_remote_datasource.dart';
import '../../data/models/thread_model.dart';

final threadDatasourceProvider = Provider<ThreadRemoteDatasource>(
  (ref) => ThreadRemoteDatasource(ref.read(dioClientProvider)),
);

class ThreadListNotifier extends AsyncNotifier<List<ThreadModel>> {
  @override
  Future<List<ThreadModel>> build() async {
    final resp = await ref.read(threadDatasourceProvider).getThreads();
    final list = resp.data ?? [];
    list.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
    return list;
  }

  Future<void> refresh() => ref.refresh(threadListProvider.future);

  Future<ThreadModel> createThread({
    required String agentId,
    String? title,
  }) async {
    final resp = await ref
        .read(threadDatasourceProvider)
        .createThread(agentId: agentId, title: title);
    final thread = resp.data!;
    state = AsyncData([thread, ...(state.value ?? [])]);
    return thread;
  }

  Future<void> delete(String id) async {
    await ref.read(threadDatasourceProvider).deleteThread(id);
    state = AsyncData(
      (state.value ?? []).where((t) => t.id != id).toList(),
    );
  }

  Future<void> deleteAll() async {
    await ref.read(threadDatasourceProvider).deleteAllThreads();
    state = const AsyncData([]);
  }

  Future<void> renameThread(String id, String title) async {
    await ref
        .read(threadDatasourceProvider)
        .updateThreadTitle(id, title);
    state = AsyncData(
      (state.value ?? [])
          .map((t) => t.id == id
              ? ThreadModel(
                  id: t.id,
                  agentId: t.agentId,
                  userId: t.userId,
                  threadId: t.threadId,
                  title: title,
                  lastMessageAt: t.lastMessageAt,
                  isArchived: t.isArchived,
                  createdAt: t.createdAt,
                  updatedAt: t.updatedAt,
                )
              : t)
          .toList(),
    );
  }
}

final threadListProvider =
    AsyncNotifierProvider<ThreadListNotifier, List<ThreadModel>>(
  ThreadListNotifier.new,
);
