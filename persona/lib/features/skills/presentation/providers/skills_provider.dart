import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/skill_remote_datasource.dart';
import '../../data/models/skill_model.dart';

final skillDatasourceProvider = Provider<SkillRemoteDatasource>(
  (ref) => SkillRemoteDatasource(ref.read(dioClientProvider)),
);

class MySkillsNotifier extends AsyncNotifier<List<SkillModel>> {
  @override
  Future<List<SkillModel>> build() async {
    final resp = await ref.read(skillDatasourceProvider).getMySkills();
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(mySkillsProvider.future);

  Future<void> create({
    required String name,
    required String description,
    required String instructions,
    required List<Map<String, dynamic>> codeSnippets,
    required bool isPublic,
  }) async {
    final resp = await ref.read(skillDatasourceProvider).createSkill(
          name: name,
          description: description,
          instructions: instructions,
          codeSnippets: codeSnippets,
          isPublic: isPublic,
        );
    state = AsyncData([resp.data!, ...(state.value ?? [])]);
  }

  Future<void> editItem(
    String id, {
    String? name,
    String? description,
    String? instructions,
    List<Map<String, dynamic>>? codeSnippets,
    bool? isPublic,
  }) async {
    final resp = await ref.read(skillDatasourceProvider).updateSkill(
          id,
          name: name,
          description: description,
          instructions: instructions,
          codeSnippets: codeSnippets,
          isPublic: isPublic,
        );
    state = AsyncData(
      (state.value ?? []).map((s) => s.id == id ? resp.data! : s).toList(),
    );
  }

  Future<void> delete(String id) async {
    await ref.read(skillDatasourceProvider).deleteSkill(id);
    state = AsyncData(
      (state.value ?? []).where((s) => s.id != id).toList(),
    );
  }
}

final mySkillsProvider =
    AsyncNotifierProvider<MySkillsNotifier, List<SkillModel>>(
  MySkillsNotifier.new,
);

class PublicSkillsNotifier extends AsyncNotifier<List<SkillModel>> {
  @override
  Future<List<SkillModel>> build() async {
    final resp = await ref.read(skillDatasourceProvider).getPublicSkills();
    return resp.data ?? [];
  }
}

final publicSkillsProvider =
    AsyncNotifierProvider<PublicSkillsNotifier, List<SkillModel>>(
  PublicSkillsNotifier.new,
);
