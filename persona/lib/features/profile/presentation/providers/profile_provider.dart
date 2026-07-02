import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/profile_remote_datasource.dart';
import '../../data/models/user_model.dart';

final profileDatasourceProvider = Provider<ProfileRemoteDatasource>(
  (ref) => ProfileRemoteDatasource(ref.read(dioClientProvider)),
);

class ProfileNotifier extends AsyncNotifier<UserModel?> {
  @override
  Future<UserModel?> build() async {
    final resp = await ref.read(profileDatasourceProvider).getProfile();
    return resp.data;
  }

  Future<void> updateProfile({
    String? name,
    int? age,
    String? summary,
  }) async {
    final resp = await ref.read(profileDatasourceProvider).updateProfile(
          name: name,
          age: age,
          summary: summary,
        );
    state = AsyncData(resp.data);
  }

  Future<void> refresh() async {
    final resp = await ref.read(profileDatasourceProvider).getProfile();
    state = AsyncData(resp.data);
  }
}

final profileProvider = AsyncNotifierProvider<ProfileNotifier, UserModel?>(
  ProfileNotifier.new,
);
