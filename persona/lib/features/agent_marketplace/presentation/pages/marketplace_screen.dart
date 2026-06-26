import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/utils/responsive.dart';
import '../../../../shared/widgets/skeleton_loader.dart';
import '../../data/models/agent_model.dart';
import '../providers/agent_provider.dart';

const _categories = [
  'All',
  'Entrepreneurship',
  'Health & Fitness',
  'Mind & Behavior',
  'Technology',
  'Life & Relationships',
  'The Library of Minds',
  'Careers',
];

// Maps display category → DB category value
const _categoryDbMap = {
  'entrepreneurship': 'productivity',
  'health & fitness': 'research',
  'mind & behavior': 'research',
  'technology': 'coding',
  'life & relationships': 'roleplay',
  'the library of minds': 'research',
  'careers': 'productivity',
};

class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  final _scrollController = ScrollController();

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
    final state = ref.watch(marketplaceProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () =>
              ref.read(marketplaceProvider.notifier).loadInitial(),
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverToBoxAdapter(child: _buildHeader(isDark)),
              SliverToBoxAdapter(
                  child: _buildCategoryPills(isDark, state.category)),
              if (state.isLoading && state.agents.isEmpty)
                SliverToBoxAdapter(child: _buildLoadingState(isDark))
              else if (state.agents.isEmpty)
                SliverToBoxAdapter(child: _buildEmpty(isDark))
              else ...[
                SliverToBoxAdapter(
                    child: _buildFeaturedCarousel(
                        state.agents.take(5).toList(), isDark)),
                SliverToBoxAdapter(child: const SizedBox(height: 16)),
                _buildTrendingSliver(
                    state.agents.toList(), state.hasMore, isDark),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  Widget _buildHeader(bool isDark) {
    final r = Responsive.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(r.horizontalPadding, 24, r.horizontalPadding, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Discover',
            style: AppTypography.headlineMedium.copyWith(
              color: isDark
                  ? AppColors.textPrimaryDark
                  : AppColors.textPrimaryLight,
              letterSpacing: -0.5,
              fontWeight: FontWeight.w400,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'Talk to trusted minds with real experience',
            style: AppTypography.bodyMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(height: 16),
          // Search
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            style: AppTypography.bodyMedium.copyWith(
              color: isDark
                  ? AppColors.textPrimaryDark
                  : AppColors.textPrimaryLight,
            ),
            decoration: InputDecoration(
              hintText: 'Search agents…',
              hintStyle: AppTypography.bodyMedium.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
              prefixIcon: Padding(
                padding: const EdgeInsets.only(left: 14, right: 10),
                child: Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                ),
              ),
              prefixIconConstraints: const BoxConstraints(),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon:
                          const Icon(Icons.close_rounded, size: 18),
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                      onPressed: () {
                        _searchController.clear();
                        ref.read(marketplaceProvider.notifier).setQuery('');
                        setState(() {});
                      },
                    )
                  : null,
              filled: true,
              fillColor: isDark
                  ? AppColors.inputFillDark
                  : AppColors.inputFillLight,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(
                  color: (isDark
                          ? AppColors.primaryDark
                          : AppColors.primaryLight)
                      .withValues(alpha: 0.4),
                ),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            ),
          ),
        ],
      ),
    );
  }

  // ── Category pills ──────────────────────────────────────────────────────────

  Widget _buildCategoryPills(bool isDark, String? selected) {
    return SizedBox(
      height: 38,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(
            horizontal: Responsive.of(context).horizontalPadding),
        itemCount: _categories.length,
        itemBuilder: (context, i) {
          final cat = _categories[i];
          final dbCat = cat == 'All'
              ? null
              : _categoryDbMap[cat.toLowerCase()];
          final isActive = cat == 'All'
              ? selected == null
              : selected == dbCat;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => ref
                  .read(marketplaceProvider.notifier)
                  .setCategory(dbCat),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isActive
                      ? (isDark
                          ? AppColors.primaryDark
                          : AppColors.primaryLight)
                      : (isDark
                          ? AppColors.inputFillDark
                          : AppColors.inputFillLight),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  cat,
                  style: AppTypography.labelMedium.copyWith(
                    color: isActive
                        ? Colors.white
                        : (isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight),
                    fontWeight:
                        isActive ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Featured carousel ───────────────────────────────────────────────────────

  Widget _buildFeaturedCarousel(List<AgentModel> agents, bool isDark) {
    if (agents.isEmpty) return const SizedBox.shrink();
    final w = MediaQuery.sizeOf(context).width >= 600 ? 230.0 : 190.0;
    final h = MediaQuery.sizeOf(context).width >= 600 ? 310.0 : 255.0;

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: SizedBox(
      height: h,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(
            horizontal: Responsive.of(context).horizontalPadding),
        itemCount: agents.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(right: 12),
          child: _FeaturedCard(agent: agents[i], width: w, height: h),
        ),
      ),
    ),
    );
  }

  // ── Trending sliver ─────────────────────────────────────────────────────────

  Widget _buildTrendingSliver(
      List<AgentModel> agents, bool hasMore, bool isDark) {
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, i) {
          if (i == agents.length) {
            return hasMore
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : const SizedBox(height: 24);
          }
          return _TrendingRow(
            agent: agents[i],
            rank: i + 1,
            isDark: isDark,
          );
        },
        childCount: agents.length + 1,
      ),
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  Widget _buildLoadingState(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 22, 16, 12),
          child: SkeletonBox(width: 150, height: 20, borderRadius: 6),
        ),
        SizedBox(
          height: 240,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: 4,
            itemBuilder: (_, _) => const Padding(
              padding: EdgeInsets.only(right: 12),
              child: SkeletonBox(width: 162, height: 240, borderRadius: 24),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 22, 16, 12),
          child: SkeletonBox(width: 100, height: 20, borderRadius: 6),
        ),
        ...List.generate(5, (_) => const ListTileSkeleton()),
      ],
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  Widget _buildEmpty(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Container(
        padding: const EdgeInsets.all(36),
        decoration: BoxDecoration(
          color: isDark
              ? AppColors.surfaceDark.withValues(alpha: 0.5)
              : const Color(0xFFF9F9F9),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.explore_off_rounded,
                size: 38,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight),
            const SizedBox(height: 14),
            Text(
              'No agents found',
              style: AppTypography.titleMedium.copyWith(
                color: isDark
                    ? AppColors.textPrimaryDark
                    : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Try a different search or category',
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Featured Card ──────────────────────────────────────────────────────────────

class _FeaturedCard extends StatefulWidget {
  const _FeaturedCard(
      {required this.agent, required this.width, required this.height});
  final AgentModel agent;
  final double width;
  final double height;

  @override
  State<_FeaturedCard> createState() => _FeaturedCardState();
}

class _FeaturedCardState extends State<_FeaturedCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () =>
          context.push(RouteNames.agentDetailPath(widget.agent.id)),
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.955 : 1.0,
        duration: const Duration(milliseconds: 140),
        child: SizedBox(
          width: widget.width,
          height: widget.height,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Background
                widget.agent.avatar.isNotEmpty
                    ? Image.network(
                        widget.agent.avatar,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            _FallbackBackground(agent: widget.agent),
                      )
                    : _FallbackBackground(agent: widget.agent),
                // Gradient overlay
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Color(0xE6000000),
                        Color(0x33000000),
                        Colors.transparent,
                      ],
                      stops: [0.0, 0.48, 1.0],
                    ),
                  ),
                ),
                // Text content
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.agent.name,
                        style: AppTypography.titleMedium.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (widget.agent.description.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          widget.agent.description,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xCCFFFFFF),
                            height: 1.35,
                            fontWeight: FontWeight.w400,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FallbackBackground extends StatelessWidget {
  const _FallbackBackground({required this.agent});
  final AgentModel agent;

  static const _gradients = [
    [Color(0xFF1A1A3E), Color(0xFF0D0D20)],
    [Color(0xFF1A2E1A), Color(0xFF0D1A0D)],
    [Color(0xFF2E1A1A), Color(0xFF1A0D0D)],
    [Color(0xFF1A1A2E), Color(0xFF0D0D1C)],
    [Color(0xFF2E2A1A), Color(0xFF1A160D)],
  ];

  @override
  Widget build(BuildContext context) {
    final pair = _gradients[agent.name.length % _gradients.length];
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: pair,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        agent.name.isNotEmpty ? agent.name[0].toUpperCase() : '?',
        style: const TextStyle(
          fontSize: 52,
          fontWeight: FontWeight.w800,
          color: Color(0x4DFFFFFF),
        ),
      ),
    );
  }
}

// ── Trending Row ───────────────────────────────────────────────────────────────

class _TrendingRow extends StatelessWidget {
  const _TrendingRow({
    required this.agent,
    required this.rank,
    required this.isDark,
  });
  final AgentModel agent;
  final int rank;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => context.push(RouteNames.agentDetailPath(agent.id)),
        borderRadius: BorderRadius.circular(16),
        hoverColor: isDark
            ? AppColors.inputFillDark
            : const Color(0xFFF4F4F4),
        splashColor: Colors.transparent,
        highlightColor: isDark
            ? AppColors.inputFillDark.withValues(alpha: 0.6)
            : const Color(0xFFF4F4F4).withValues(alpha: 0.6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? AppColors.dividerDark.withValues(alpha: 0.5)
                    : const Color(0xFFF0F0EE),
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: avatar + name + description
              Row(
                children: [
                  // Circular avatar + rank badge bottom-left
                  SizedBox(
                    width: 56,
                    height: 56,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isDark
                                  ? AppColors.dividerDark
                                  : const Color(0xFFE8E8E3),
                            ),
                          ),
                          child: ClipOval(
                            child: agent.avatar.isNotEmpty
                                ? Image.network(
                                    agent.avatar,
                                    width: 56,
                                    height: 56,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) =>
                                        _avatarFallback(),
                                  )
                                : _avatarFallback(),
                          ),
                        ),
                        // Rank badge — bottom-LEFT, circular
                        Positioned(
                          bottom: -2,
                          left: -2,
                          child: Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: isDark
                                  ? AppColors.backgroundDark
                                  : AppColors.backgroundLight,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isDark
                                    ? AppColors.dividerDark
                                    : const Color(0xFFDFDFDA),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color:
                                      Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '$rank',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: isDark
                                    ? AppColors.textSecondaryDark
                                    : AppColors.textSecondaryLight,
                                height: 1,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Name + mindCount + description
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                agent.name,
                                style: AppTypography.bodyLarge.copyWith(
                                  color: isDark
                                      ? AppColors.textPrimaryDark
                                      : AppColors.textPrimaryLight,
                                  fontWeight: FontWeight.w700,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${agent.messageCount} Chats',
                              style: AppTypography.labelSmall.copyWith(
                                color: isDark
                                    ? AppColors.textSecondaryDark
                                    : AppColors.textSecondaryLight,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          agent.description,
                          style: AppTypography.labelSmall.copyWith(
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              // Chat bubble below — full width on mobile (matches web flex-col on sm)
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.inputFillDark
                      : const Color(0xFFF9F9F9),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(0),
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                  border: Border.all(
                    color: isDark
                        ? AppColors.dividerDark
                        : const Color(0xFFEDEDED),
                  ),
                ),
                child: Text(
                  _suggestedPrompt(),
                  style: AppTypography.bodySmall.copyWith(
                    color: isDark
                        ? const Color(0xFFD4D4D0)
                        : const Color(0xFF52525B),
                    fontWeight: FontWeight.w600,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _avatarFallback() {
    return Container(
      width: 56,
      height: 56,
      color: AppColors.primaryLight.withValues(alpha: 0.1),
      alignment: Alignment.center,
      child: Text(
        agent.name.isNotEmpty ? agent.name[0].toUpperCase() : '?',
        style: const TextStyle(
          color: AppColors.primaryLight,
          fontWeight: FontWeight.w700,
          fontSize: 20,
        ),
      ),
    );
  }

  String _suggestedPrompt() {
    return switch (agent.category) {
      'coding' => 'Help me debug this',
      'creative' => 'Write a story for me',
      'research' => 'Summarize this topic',
      'productivity' => 'Plan my week',
      'roleplay' => "Let's roleplay…",
      _ => 'Ask me anything',
    };
  }
}
