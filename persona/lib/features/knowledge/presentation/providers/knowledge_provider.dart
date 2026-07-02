import 'package:dio/dio.dart';
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
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .getKnowledgeBases();
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(knowledgeListProvider.future);

  Future<KnowledgeBaseModel> create({
    required String name,
    required String description,
    required String providerId,
    required String embeddingModel,
    required int chunkSize,
    required int chunkOverlap,
    required int topK,
  }) async {
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .createKnowledgeBase(
          name: name,
          description: description,
          providerId: providerId,
          embeddingModel: embeddingModel,
          chunkSize: chunkSize,
          chunkOverlap: chunkOverlap,
          topK: topK,
        );
    final created = resp.data!;
    state = AsyncData([created, ...(state.value ?? [])]);
    return created;
  }

  Future<KnowledgeBaseModel> editItem(
    String id, {
    String? name,
    String? description,
  }) async {
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .updateKnowledgeBase(id, name: name, description: description);
    final updated = resp.data!;
    state = AsyncData(
      (state.value ?? []).map((kb) => kb.id == id ? updated : kb).toList(),
    );
    ref.invalidate(knowledgeBaseProvider(id));
    return updated;
  }

  Future<void> delete(String id) async {
    await ref.read(knowledgeDatasourceProvider).deleteKnowledgeBase(id);
    state = AsyncData((state.value ?? []).where((kb) => kb.id != id).toList());
    ref.invalidate(knowledgeBaseProvider(id));
  }
}

final knowledgeListProvider =
    AsyncNotifierProvider<KnowledgeListNotifier, List<KnowledgeBaseModel>>(
      KnowledgeListNotifier.new,
    );

class KnowledgeBaseNotifier extends AsyncNotifier<KnowledgeBaseModel> {
  KnowledgeBaseNotifier(this._kbId);

  final String _kbId;

  @override
  Future<KnowledgeBaseModel> build() async {
    for (final kb
        in ref.read(knowledgeListProvider).value ?? <KnowledgeBaseModel>[]) {
      if (kb.id == _kbId) return kb;
    }
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .getKnowledgeBaseById(_kbId);
    return resp.data!;
  }
}

final knowledgeBaseProvider =
    AsyncNotifierProvider.family<
      KnowledgeBaseNotifier,
      KnowledgeBaseModel,
      String
    >(KnowledgeBaseNotifier.new);

class KnowledgeDocumentsNotifier
    extends AsyncNotifier<List<KnowledgeDocumentModel>> {
  KnowledgeDocumentsNotifier(this._kbId);

  final String _kbId;

  @override
  Future<List<KnowledgeDocumentModel>> build() async {
    final resp = await ref
        .read(knowledgeDatasourceProvider)
        .getDocuments(_kbId);
    return resp.data ?? [];
  }

  Future<void> uploadFiles(
    List<String> paths, {
    ProgressCallback? onSendProgress,
  }) async {
    await ref
        .read(knowledgeDatasourceProvider)
        .uploadFiles(_kbId, paths, onSendProgress: onSendProgress);
    ref.invalidateSelf();
    ref.invalidate(knowledgeBaseProvider(_kbId));
    ref.invalidate(knowledgeListProvider);
  }

  Future<void> deleteDocument(String sourceName) async {
    await ref
        .read(knowledgeDatasourceProvider)
        .deleteDocument(_kbId, sourceName);
    state = AsyncData(
      (state.value ?? [])
          .where((document) => document.sourceName != sourceName)
          .toList(),
    );
    ref.invalidate(knowledgeBaseProvider(_kbId));
    ref.invalidate(knowledgeListProvider);
  }
}

final knowledgeDocumentsProvider =
    AsyncNotifierProvider.family<
      KnowledgeDocumentsNotifier,
      List<KnowledgeDocumentModel>,
      String
    >(KnowledgeDocumentsNotifier.new);
