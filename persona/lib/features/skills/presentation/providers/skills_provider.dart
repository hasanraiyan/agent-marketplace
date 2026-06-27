import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../agent_marketplace/data/models/agent_model.dart';
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

  Future<SkillModel> create({
    required String name,
    required String description,
    required String instructions,
    List<Map<String, dynamic>> codeSnippets = const [],
    required bool isPublic,
  }) async {
    final resp = await ref
        .read(skillDatasourceProvider)
        .createSkill(
          name: name,
          description: description,
          instructions: instructions,
          codeSnippets: codeSnippets,
          isPublic: isPublic,
        );
    final created = resp.data!;
    state = AsyncData([created, ...(state.value ?? [])]);
    return created;
  }

  Future<SkillModel> editItem(
    String id, {
    String? name,
    String? description,
    String? instructions,
    List<Map<String, dynamic>>? codeSnippets,
    bool? isPublic,
  }) async {
    final resp = await ref
        .read(skillDatasourceProvider)
        .updateSkill(
          id,
          name: name,
          description: description,
          instructions: instructions,
          codeSnippets: codeSnippets,
          isPublic: isPublic,
        );
    final updated = resp.data!;
    state = AsyncData(
      (state.value ?? []).map((s) => s.id == id ? updated : s).toList(),
    );
    ref.invalidate(skillDetailProvider(id));
    return updated;
  }

  Future<void> delete(String id) async {
    await ref.read(skillDatasourceProvider).deleteSkill(id);
    state = AsyncData((state.value ?? []).where((s) => s.id != id).toList());
    ref.invalidate(skillDetailProvider(id));
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

class SkillDetailNotifier extends AsyncNotifier<SkillModel> {
  SkillDetailNotifier(this._skillId);

  final String _skillId;

  @override
  Future<SkillModel> build() async {
    SkillModel? cached;
    for (final skill in ref.read(mySkillsProvider).value ?? <SkillModel>[]) {
      if (skill.id == _skillId) {
        cached = skill;
        break;
      }
    }
    if (cached != null) return cached.copyWith(isOwner: true);

    SkillModel? publicCached;
    for (final skill
        in ref.read(publicSkillsProvider).value ?? <SkillModel>[]) {
      if (skill.id == _skillId) {
        publicCached = skill;
        break;
      }
    }
    if (publicCached != null && publicCached.instructions.isNotEmpty) {
      return publicCached;
    }

    final resp = await ref.read(skillDatasourceProvider).getSkillById(_skillId);
    return resp.data!;
  }
}

final skillDetailProvider =
    AsyncNotifierProvider.family<SkillDetailNotifier, SkillModel, String>(
      SkillDetailNotifier.new,
    );

final skillAgentsProvider = FutureProvider.family<List<AgentModel>, String>((
  ref,
  skillId,
) async {
  final resp = await ref.read(skillDatasourceProvider).getUsedByAgents(skillId);
  return resp.data ?? [];
});
