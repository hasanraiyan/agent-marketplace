import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/knowledge_remote_datasource.dart';
import '../../data/models/knowledge_model.dart';

final knowledgeDatasourceProvider = Provider<KnowledgeRemoteDatasource>(
  (ref) => KnowledgeRemoteDatasource(ref.read(dioClientProvider)),
);

class KnowledgeListNotifier extends AsyncNotifier<List<KnowledgeBaseModel>> {
  @override
  Future<List<KnowledgeBaseModel>> build() async {
    final resp =
        await ref.read(knowledgeDatasourceProvider).getKnowledgeBases();
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(knowledgeListProvider.future);

  Future<void> create({
    required String name,
    required String description,
  }) async {
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .createKnowledgeBase(name: name, description: description);
    state = AsyncData([resp.data!, ...(state.value ?? [])]);
  }

  Future<void> delete(String id) async {
    await ref.read(knowledgeDatasourceProvider).deleteKnowledgeBase(id);
    state = AsyncData(
      (state.value ?? []).where((kb) => kb.id != id).toList(),
    );
  }
}

final knowledgeListProvider =
    AsyncNotifierProvider<KnowledgeListNotifier, List<KnowledgeBaseModel>>(
  KnowledgeListNotifier.new,
);

// ── Knowledge base detail (documents) ────────────────────────────────────────

class KnowledgeDetailNotifier
    extends AsyncNotifier<List<KnowledgeDocumentModel>> {
  KnowledgeDetailNotifier(this._kbId);
  final String _kbId;

  @override
  Future<List<KnowledgeDocumentModel>> build() async {
    final resp =
        await ref.read(knowledgeDatasourceProvider).getDocuments(_kbId);
    return resp.data ?? [];
  }

  Future<void> uploadDocument(String sourceUrl) async {
    await ref
        .read(knowledgeDatasourceProvider)
        .uploadDocument(_kbId, sourceUrl);
    ref.invalidateSelf();
  }

  Future<void> deleteDocument(String sourceName) async {
    await ref
        .read(knowledgeDatasourceProvider)
        .deleteDocument(_kbId, sourceName);
    state = AsyncData(
      (state.value ?? [])
          .where((d) => d.sourceName != sourceName)
          .toList(),
    );
  }
}

final knowledgeDetailProvider = AsyncNotifierProvider.family<
    KnowledgeDetailNotifier, List<KnowledgeDocumentModel>, String>(
  KnowledgeDetailNotifier.new,
);
