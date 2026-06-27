import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../connectors/presentation/widgets/connector_widgets.dart';
import '../../../provider_keys/presentation/providers/provider_notifier.dart';
import '../providers/knowledge_provider.dart';

class KnowledgeFormScreen extends ConsumerStatefulWidget {
  const KnowledgeFormScreen({super.key});

  @override
  ConsumerState<KnowledgeFormScreen> createState() =>
      _KnowledgeFormScreenState();
}

class _KnowledgeFormScreenState extends ConsumerState<KnowledgeFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _chunkSizeCtrl = TextEditingController(text: '800');
  final _chunkOverlapCtrl = TextEditingController(text: '100');
  final _topKCtrl = TextEditingController(text: '5');

  String _embeddingModel = 'text-embedding-3-small';
  String? _providerId;
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _chunkSizeCtrl.dispose();
    _chunkOverlapCtrl.dispose();
    _topKCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(providerListProvider);

    return ConnectorPageScaffold(
      title: 'New Knowledge Base',
      section: ConnectorSection.knowledge,
      child: providersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.refresh(providerListProvider.future),
        ),
        data: (providers) {
          if (_providerId == null && providers.isNotEmpty) {
            final defaultProvider = providers
                .where((provider) => provider.isDefault)
                .cast<dynamic>()
                .toList();
            _providerId = defaultProvider.isNotEmpty
                ? defaultProvider.first.id as String
                : providers.first.id;
          }

          return Form(
            key: _formKey,
            child: ConnectorScrollableContent(
              maxWidth: 760,
              children: [
                const ConnectorIntro(
                  title: 'Create Knowledge Base',
                  description:
                      'Configure the embedding provider and retrieval settings.',
                ),
                TextFormField(
                  controller: _nameCtrl,
                  maxLength: 200,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Name is required';
                    }
                    return null;
                  },
                  decoration: _decoration(label: 'Name', hint: 'Product Docs'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descCtrl,
                  minLines: 3,
                  maxLines: 5,
                  maxLength: 1000,
                  decoration: _decoration(
                    label: 'Description',
                    hint: 'Documentation and support articles for agents.',
                  ),
                ),
                const SizedBox(height: 12),
                if (providers.isEmpty)
                  DetailCard(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          color: AppColors.warning,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Add an AI provider before creating a knowledge base.',
                            style: AppTypography.bodyMedium,
                          ),
                        ),
                        TextButton(
                          onPressed: () => context.push(RouteNames.providers),
                          child: const Text('Providers'),
                        ),
                      ],
                    ),
                  )
                else
                  DropdownButtonFormField<String>(
                    initialValue: _providerId,
                    decoration: _decoration(label: 'AI Provider'),
                    validator: (value) =>
                        value == null ? 'Provider is required' : null,
                    items: providers
                        .map(
                          (provider) => DropdownMenuItem(
                            value: provider.id,
                            child: Text(
                              provider.isDefault
                                  ? '${provider.label} (default)'
                                  : provider.label,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => _providerId = value),
                  ),
                const SizedBox(height: 14),
                DetailCard(
                  padding: EdgeInsets.zero,
                  child: ExpansionTile(
                    tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    title: Text(
                      'Advanced',
                      style: AppTypography.titleSmall.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _embeddingModel,
                        decoration: _decoration(label: 'Embedding Model'),
                        items: const [
                          DropdownMenuItem(
                            value: 'text-embedding-3-small',
                            child: Text('text-embedding-3-small (1536)'),
                          ),
                          DropdownMenuItem(
                            value: 'text-embedding-3-large',
                            child: Text('text-embedding-3-large (3072)'),
                          ),
                          DropdownMenuItem(
                            value: 'text-embedding-ada-002',
                            child: Text('text-embedding-ada-002 (1536)'),
                          ),
                        ],
                        onChanged: (value) => setState(
                          () => _embeddingModel =
                              value ?? 'text-embedding-3-small',
                        ),
                      ),
                      const SizedBox(height: 12),
                      _NumberField(
                        controller: _chunkSizeCtrl,
                        label: 'Chunk Size',
                        min: 100,
                        max: 8000,
                      ),
                      const SizedBox(height: 12),
                      _NumberField(
                        controller: _chunkOverlapCtrl,
                        label: 'Chunk Overlap',
                        min: 0,
                        max: 2000,
                      ),
                      const SizedBox(height: 12),
                      _NumberField(
                        controller: _topKCtrl,
                        label: 'Top K',
                        min: 1,
                        max: 50,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: providers.isEmpty || _loading ? null : _create,
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'Create Knowledge Base',
                            style: AppTypography.labelLarge,
                          ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  InputDecoration _decoration({required String label, String? hint}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
    );
  }

  Future<void> _create() async {
    if (!_formKey.currentState!.validate() || _providerId == null) return;
    setState(() => _loading = true);
    try {
      final created = await ref
          .read(knowledgeListProvider.notifier)
          .create(
            name: _nameCtrl.text.trim(),
            description: _descCtrl.text.trim(),
            providerId: _providerId!,
            embeddingModel: _embeddingModel,
            chunkSize: int.parse(_chunkSizeCtrl.text),
            chunkOverlap: int.parse(_chunkOverlapCtrl.text),
            topK: int.parse(_topKCtrl.text),
          );
      if (mounted) context.go(RouteNames.knowledgeDetailPath(created.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.controller,
    required this.label,
    required this.min,
    required this.max,
  });

  final TextEditingController controller;
  final String label;
  final int min;
  final int max;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      validator: (value) {
        final parsed = int.tryParse(value ?? '');
        if (parsed == null) return 'Enter a number';
        if (parsed < min || parsed > max) return 'Use $min-$max';
        return null;
      },
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: isDark ? AppColors.inputFillDark : AppColors.inputFillLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
