import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../providers/agent_provider.dart';
import '../widgets/agent_card.dart';

const _categories = [
  'All',
  'productivity',
  'coding',
  'creative',
  'research',
  'roleplay',
  'other',
];

class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  final _scrollController = ScrollController();
  bool _gridView = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(marketplaceProvider.notifier).loadMore();
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(marketplaceProvider.notifier).setQuery(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = Responsive.of(context);
    final state = ref.watch(marketplaceProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark, r),
            _buildCategoryChips(context, isDark, state.category),
            Expanded(
              child: _buildContent(context, isDark, r, state),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
      BuildContext context, bool isDark, Responsive r) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          r.horizontalPadding, 16, r.horizontalPadding, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Marketplace',
                  style: AppTypography.headlineSmall.copyWith(
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => setState(() => _gridView = !_gridView),
                icon: Icon(
                  _gridView
                      ? Icons.view_list_rounded
                      : Icons.grid_view_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search agents…',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded),
                      onPressed: () {
                        _searchController.clear();
                        ref
                            .read(marketplaceProvider.notifier)
                            .setQuery('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: isDark
                  ? AppColors.inputFillDark
                  : AppColors.inputFillLight,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChips(
      BuildContext context, bool isDark, String? selected) {
    return SizedBox(
      height: 44,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(
            horizontal: Responsive.of(context).horizontalPadding),
        itemCount: _categories.length,
        itemBuilder: (context, i) {
          final cat = _categories[i];
          final isSelected = cat == 'All'
              ? selected == null
              : selected == cat;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                cat == 'All' ? cat : _capitalize(cat),
                style: AppTypography.labelMedium.copyWith(
                  color: isSelected
                      ? Colors.white
                      : isDark
                          ? AppColors.textPrimaryDark
                          : AppColors.textPrimaryLight,
                ),
              ),
              selected: isSelected,
              onSelected: (_) => ref
                  .read(marketplaceProvider.notifier)
                  .setCategory(cat == 'All' ? null : cat),
              selectedColor:
                  isDark ? AppColors.primaryDark : AppColors.primaryLight,
              backgroundColor: isDark
                  ? AppColors.surfaceDark
                  : AppColors.surfaceLight,
              showCheckmark: false,
            ),
          );
        },
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    bool isDark,
    Responsive r,
    MarketplaceState state,
  ) {
    if (state.isLoading && state.agents.isEmpty) {
      return _buildSkeletons(r);
    }

    if (state.error != null && state.agents.isEmpty) {
      return ErrorState(
        message: state.error!,
        onRetry: () =>
            ref.read(marketplaceProvider.notifier).loadInitial(),
      );
    }

    if (state.agents.isEmpty) {
      return const EmptyState(
        icon: Icons.explore_off_rounded,
        title: 'No agents found',
        subtitle: 'Try a different search or category',
      );
    }

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(marketplaceProvider.notifier).loadInitial(),
      child: _gridView ? _buildGrid(r, state) : _buildList(r, state),
    );
  }

  Widget _buildGrid(Responsive r, MarketplaceState state) {
    return GridView.builder(
      controller: _scrollController,
      padding: EdgeInsets.all(r.horizontalPadding),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: r.agentGridColumns,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.9,
      ),
      itemCount: state.agents.length + (state.hasMore ? 1 : 0),
      itemBuilder: (context, i) {
        if (i == state.agents.length) {
          return const Center(
              child: Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(strokeWidth: 2),
          ));
        }
        return AgentCard(agent: state.agents[i]);
      },
    );
  }

  Widget _buildList(Responsive r, MarketplaceState state) {
    return ListView.builder(
      controller: _scrollController,
      padding: EdgeInsets.symmetric(
          horizontal: r.horizontalPadding, vertical: 8),
      itemCount: state.agents.length + (state.hasMore ? 1 : 0),
      itemBuilder: (context, i) {
        if (i == state.agents.length) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AgentCard(agent: state.agents[i]),
        );
      },
    );
  }

  Widget _buildSkeletons(Responsive r) {
    return GridView.builder(
      padding: EdgeInsets.all(r.horizontalPadding),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: r.agentGridColumns,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.9,
      ),
      itemCount: 12,
      itemBuilder: (_, _) => const AgentCardSkeleton(),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
