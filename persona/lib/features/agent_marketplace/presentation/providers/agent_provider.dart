import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/agent_remote_datasource.dart';
import '../../data/models/agent_model.dart';

// ── Datasource ────────────────────────────────────────────────────────────────

final agentDatasourceProvider = Provider<AgentRemoteDatasource>(
  (ref) => AgentRemoteDatasource(ref.read(dioClientProvider)),
);

// ── Marketplace search state ──────────────────────────────────────────────────

class MarketplaceState {
  const MarketplaceState({
    this.agents = const [],
    this.query = '',
    this.category,
    this.isLoading = false,
    this.hasMore = true,
    this.page = 1,
    this.error,
  });

  final List<AgentModel> agents;
  final String query;
  final String? category;
  final bool isLoading;
  final bool hasMore;
  final int page;
  final String? error;

  MarketplaceState copyWith({
    List<AgentModel>? agents,
    String? query,
    String? category,
    bool? isLoading,
    bool? hasMore,
    int? page,
    String? error,
    bool clearError = false,
  }) {
    return MarketplaceState(
      agents: agents ?? this.agents,
      query: query ?? this.query,
      category: category ?? this.category,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class MarketplaceNotifier extends Notifier<MarketplaceState> {
  static const _pageSize = 20;

  @override
  MarketplaceState build() {
    Future.microtask(loadInitial);
    return const MarketplaceState(isLoading: true);
  }

  AgentRemoteDatasource get _ds => ref.read(agentDatasourceProvider);

  Future<void> loadInitial() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final resp = await _ds.searchAgents(
        query: state.query.isEmpty ? null : state.query,
        category: state.category,
        visibility: 'public',
        page: 1,
        limit: _pageSize,
      );
      final agents = resp.data ?? [];
      state = state.copyWith(
        agents: agents,
        page: 1,
        hasMore: agents.length >= _pageSize,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore) return;
    state = state.copyWith(isLoading: true);
    try {
      final nextPage = state.page + 1;
      final resp = await _ds.searchAgents(
        query: state.query.isEmpty ? null : state.query,
        category: state.category,
        visibility: 'public',
        page: nextPage,
        limit: _pageSize,
      );
      final more = resp.data ?? [];
      state = state.copyWith(
        agents: [...state.agents, ...more],
        page: nextPage,
        hasMore: more.length >= _pageSize,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setQuery(String q) {
    state = state.copyWith(query: q);
    loadInitial();
  }

  void setCategory(String? cat) {
    state = state.copyWith(category: cat == state.category ? null : cat);
    loadInitial();
  }
}

final marketplaceProvider =
    NotifierProvider<MarketplaceNotifier, MarketplaceState>(
  MarketplaceNotifier.new,
);

// ── Single agent detail ───────────────────────────────────────────────────────

class AgentDetailNotifier extends AsyncNotifier<AgentModel> {
  AgentDetailNotifier(this._agentId);
  final String _agentId;

  @override
  Future<AgentModel> build() async {
    final resp =
        await ref.read(agentDatasourceProvider).getAgentById(_agentId);
    return resp.data!;
  }
}

final agentDetailProvider =
    AsyncNotifierProvider.family<AgentDetailNotifier, AgentModel, String>(
  AgentDetailNotifier.new,
);

// ── My agents ────────────────────────────────────────────────────────────────

class MyAgentsNotifier extends AsyncNotifier<List<AgentModel>> {
  @override
  Future<List<AgentModel>> build() async {
    final resp = await ref.read(agentDatasourceProvider).searchAgents(
          visibility: 'own',
        );
    return resp.data ?? [];
  }

  Future<void> refresh() => ref.refresh(myAgentsProvider.future);

  Future<void> delete(String id) async {
    await ref.read(agentDatasourceProvider).deleteAgent(id);
    state = AsyncData(
      (state.value ?? []).where((a) => a.id != id).toList(),
    );
  }
}

final myAgentsProvider =
    AsyncNotifierProvider<MyAgentsNotifier, List<AgentModel>>(
  MyAgentsNotifier.new,
);
