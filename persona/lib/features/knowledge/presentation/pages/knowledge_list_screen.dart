import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../data/models/knowledge_model.dart';
import '../providers/knowledge_provider.dart';

class KnowledgeListScreen extends ConsumerStatefulWidget {
  const KnowledgeListScreen({super.key});

  @override
  ConsumerState<KnowledgeListScreen> createState() =>
      _KnowledgeListScreenState();
}

class _KnowledgeListScreenState extends ConsumerState<KnowledgeListScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final kbsAsync = ref.watch(knowledgeListProvider);

    return ConnectorPageScaffold(
      title: 'Knowledge Bases',
      section: ConnectorSection.knowledge,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RouteNames.knowledgeNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New KB'),
        backgroundColor: isDark
            ? AppColors.primaryDark
            : AppColors.primaryLight,
        foregroundColor: Colors.white,
      ),
      child: kbsAsync.when(
        loading: () => const ConnectorScrollableContent(
          children: [
            ConnectorIntro(
              title: 'Knowledge Bases',
              description:
                  'Upload documents and let agents search them with retrieval.',
            ),
            ConnectorSkeletonGrid(),
          ],
        ),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(knowledgeListProvider.future),
        ),
        data: (kbs) => RefreshIndicator(
          onRefresh: () => ref.refresh(knowledgeListProvider.future),
          child: _KnowledgeListContent(
            kbs: kbs,
            query: _query,
            searchCtrl: _searchCtrl,
            onQueryChanged: (value) => setState(() => _query = value),
            onClearSearch: () {
              _searchCtrl.clear();
              setState(() => _query = '');
            },
          ),
        ),
      ),
    );
  }
}

class _KnowledgeListContent extends StatelessWidget {
  const _KnowledgeListContent({
    required this.kbs,
    required this.query,
    required this.searchCtrl,
    required this.onQueryChanged,
    required this.onClearSearch,
  });

  final List<KnowledgeBaseModel> kbs;
  final String query;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final filtered = normalized.isEmpty
        ? kbs
        : kbs.where((kb) {
            final haystack = '${kb.name} ${kb.description} ${kb.embeddingModel}'
                .toLowerCase();
            return haystack.contains(normalized);
          }).toList();

    return ConnectorScrollableContent(
      children: [
        const ConnectorIntro(
          title: 'Knowledge Bases',
          description:
              'Upload documents and let agents search them with retrieval.',
        ),
        if (kbs.isNotEmpty) ...[
          ConnectorSearchField(
            controller: searchCtrl,
            hintText: 'Search knowledge bases',
            onChanged: onQueryChanged,
            onClear: onClearSearch,
          ),
          const SizedBox(height: 16),
        ],
        if (kbs.isEmpty)
          EmptyState(
            icon: Icons.library_books_outlined,
            title: 'No knowledge bases',
            subtitle:
                'Create a knowledge base, then upload files for retrieval.',
            action: FilledButton.icon(
              onPressed: () => context.push(RouteNames.knowledgeNew),
              icon: const Icon(Icons.add_rounded),
              label: const Text('New KB'),
            ),
          )
        else if (filtered.isEmpty)
          EmptyState(
            icon: Icons.search_rounded,
            title: 'No matching knowledge bases',
            subtitle: 'Try a different name, description, or embedding model.',
            action: FilledButton.tonal(
              onPressed: onClearSearch,
              child: const Text('Clear search'),
            ),
          )
        else
          ConnectorGrid(
            itemCount: filtered.length,
            itemBuilder: (context, index) =>
                _KnowledgeCard(kb: filtered[index]),
          ),
      ],
    );
  }
}

class _KnowledgeCard extends StatelessWidget {
  const _KnowledgeCard({required this.kb});

  final KnowledgeBaseModel kb;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ConnectorCardFrame(
      icon: Icons.library_books_rounded,
      color: ConnectorSection.knowledge.color,
      title: kb.name,
      description: kb.description,
      badge: ConnectorBadge(
        label: 'RAG',
        color: ConnectorSection.knowledge.color,
      ),
      onTap: () => context.push(RouteNames.knowledgeDetailPath(kb.id)),
      footer: Row(
        children: [
          Icon(
            Icons.description_rounded,
            size: 16,
            color: isDark
                ? AppColors.textSecondaryDark
                : AppColors.textSecondaryLight,
          ),
          const SizedBox(width: 6),
          Text(
            '${kb.documentCount} docs',
            style: AppTypography.labelMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${kb.chunkCount} chunks',
            style: AppTypography.labelMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }
}
