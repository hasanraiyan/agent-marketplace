import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import '../utils/tool_presentation.dart';
import 'persona_subagent_activity_dialog.dart';
import 'tool_cards/persona_file_diff_card.dart';
import 'tool_cards/persona_grep_results_card.dart';
import 'tool_cards/persona_ls_directory_card.dart';
import 'tool_cards/persona_read_file_card.dart';
import 'tool_cards/persona_search_results_card.dart';

/// Callback signature for a custom per-tool renderer override — mirrors
/// `sdk/ui`'s `ToolRendererMap`.
typedef PersonaToolRenderer =
    Widget Function(BuildContext context, PersonaToolCall toolCall, Object? args, Object? result, bool isExecuting);

/// One tool call's card — collapsed by default, showing a humanized title +
/// icon + status/count badge; expands into the specialized card matching
/// the tool's type (search results, code viewer, directory listing, diff,
/// grep matches) or a generic args/result JSON accordion for anything else.
/// A `task` (subagent) tool call opens [PersonaSubagentActivityDialog]
/// instead of expanding inline. Mirrors `PersonaToolTrace.tsx`.
class PersonaToolTrace extends StatefulWidget {
  const PersonaToolTrace({
    super.key,
    required this.toolCall,
    this.toolRenderers,
    this.onOpenFile,
    this.isLive = false,
  });

  final PersonaToolCall toolCall;
  final Map<String, PersonaToolRenderer>? toolRenderers;
  final ValueChanged<String>? onOpenFile;

  /// Whether the parent message is an actively-streaming live run. A
  /// reloaded historical tool call has no live "in progress" signal —
  /// `result == null` there doesn't reliably mean "still running" the way
  /// it does mid-stream. @default false
  final bool isLive;

  @override
  State<PersonaToolTrace> createState() => _PersonaToolTraceState();
}

class _PersonaToolTraceState extends State<PersonaToolTrace> {
  bool _isOpen = false;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final toolCall = widget.toolCall;
    final args = _tryDecode(toolCall.args);
    final result = _tryDecode(toolCall.result);
    final argsMap = args is Map<String, dynamic> ? args : const <String, dynamic>{};
    final isExecuting = widget.isLive && toolCall.result == null && !toolCall.isError;

    final custom = widget.toolRenderers?[toolCall.toolName] ?? widget.toolRenderers?['default'];
    if (custom != null && toolCall.result != null) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: custom(context, toolCall, args, result, isExecuting));
    }

    if (toolCall.toolName == 'present_file' && !toolCall.isError) {
      return _PresentFileCard(toolCall: toolCall, args: argsMap, onOpenFile: widget.onOpenFile);
    }

    final isSubagent = isSubagentTool(toolCall.toolName);
    final isTodo = isTodoTool(toolCall.toolName);
    final todos = isTodo ? _parseTodos(argsMap, result) : null;
    final isLs = isLsTool(toolCall.toolName);
    final isRead = isReadFileTool(toolCall.toolName);
    final isSearch = isWebSearchTool(toolCall.toolName);
    final isGrep = isGrepTool(toolCall.toolName);
    final diffStats = toolCall.isError ? null : computeFileDiffStats(toolCall.toolName, argsMap);
    final isDiff = (isFileWriteTool(toolCall.toolName) || isFileEditTool(toolCall.toolName)) && diffStats != null;

    final subToolUses = toolCall.subagentActivity?.where((e) => e.kind == PersonaSubagentActivityKind.toolStart).length ?? 0;
    final title = todos != null
        ? 'Plan (${todos.where((t) => t.status == 'completed').length}/${todos.length})'
        : getToolTitle(toolCall.toolName, argsMap, done: !isExecuting);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () {
              if (isSubagent) {
                showDialog<void>(
                  context: context,
                  builder: (_) => PersonaSubagentActivityDialog(
                    toolCall: toolCall,
                    toolRenderers: widget.toolRenderers,
                    onOpenFile: widget.onOpenFile,
                    isLive: widget.isLive,
                  ),
                );
                return;
              }
              setState(() => _isOpen = !_isOpen);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Icon(getToolIcon(toolCall.toolName), size: 16, color: toolCall.isError ? Colors.red : theme.text.withValues(alpha: 0.6)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: title, style: TextStyle(color: theme.text, fontSize: 13, fontWeight: FontWeight.w600)),
                          if (isSubagent && subToolUses > 0)
                            TextSpan(
                              text: ' · $subToolUses ${subToolUses == 1 ? 'tool use' : 'tool uses'}',
                              style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 12),
                            ),
                        ],
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _StatusBadge(
                    todos: todos,
                    diffStats: diffStats,
                    isExecuting: isExecuting,
                    isError: toolCall.isError,
                    isSearch: isSearch,
                    isGrep: isGrep,
                    searchResultCount: isSearch ? searchResults(result).length : 0,
                    grepMatchCount: isGrep ? parseGrepResults(toolCall.result).length : 0,
                  ),
                  const SizedBox(width: 4),
                  if (!isSubagent)
                    Icon(_isOpen ? Icons.expand_less : Icons.expand_more, size: 18, color: theme.text.withValues(alpha: 0.4)),
                ],
              ),
            ),
          ),
          if (toolCall.isError)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: Colors.red.withValues(alpha: 0.06),
              child: Text(
                (result is Map && result['message'] is String) ? result['message'] as String : (toolCall.result ?? 'The tool call failed.'),
                style: const TextStyle(color: Colors.red, fontSize: 11),
              ),
            ),
          if (_isOpen && !isSubagent)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.border))),
              child: _buildExpanded(
                theme: theme,
                todos: todos,
                isLs: isLs,
                isRead: isRead,
                isDiff: isDiff,
                isGrep: isGrep,
                isSearch: isSearch,
                argsMap: argsMap,
                result: result,
                toolCall: toolCall,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildExpanded({
    required PersonaChatTheme theme,
    required List<_Todo>? todos,
    required bool isLs,
    required bool isRead,
    required bool isDiff,
    required bool isGrep,
    required bool isSearch,
    required Map<String, dynamic> argsMap,
    required Object? result,
    required PersonaToolCall toolCall,
  }) {
    if (todos != null) return _TodoChecklist(todos: todos);

    final done = !(widget.isLive && toolCall.result == null && !toolCall.isError);

    if (isLs) {
      final path = (argsMap['path'] ?? argsMap['dir'] ?? argsMap['directory'] ?? '/').toString();
      return PersonaLsDirectoryCard(path: path, entries: parseLsResults(toolCall.result), done: done);
    }

    if (isRead) {
      return PersonaReadFileCard(
        filePath: getFilePathFromArgs(argsMap),
        content: toolCall.result ?? '',
        done: done,
      );
    }

    if (isDiff) {
      if (isFileEditTool(toolCall.toolName)) {
        return PersonaFileDiffCard(
          filePath: getFilePathFromArgs(argsMap),
          oldContent: (argsMap['old_string'] ?? '').toString(),
          newContent: (argsMap['new_string'] ?? '').toString(),
          note: argsMap['replace_all'] == true ? 'Replacing all occurrences' : null,
        );
      }
      return PersonaFileDiffCard(
        filePath: getFilePathFromArgs(argsMap),
        oldContent: '',
        newContent: (argsMap['content'] ?? '').toString(),
      );
    }

    if (isGrep) {
      final query = (argsMap['pattern'] ?? argsMap['Query'] ?? argsMap['query'] ?? '').toString();
      final path = (argsMap['path'] ?? argsMap['SearchPath'] ?? argsMap['searchPath'] ?? '/').toString();
      return PersonaGrepResultsCard(query: query, path: path, matches: parseGrepResults(toolCall.result), done: done);
    }

    if (isSearch) {
      return PersonaSearchResultsCard(results: searchResults(result), done: done);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (toolCall.args != null) ...[
          Text('Arguments', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          _CodeBlock(text: argsMap.isNotEmpty ? const JsonEncoder.withIndent('  ').convert(argsMap) : toolCall.args!),
          const SizedBox(height: 10),
        ],
        if (toolCall.result != null) ...[
          Text('Result', style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          _CodeBlock(text: result is Map ? const JsonEncoder.withIndent('  ').convert(result) : toolCall.result!),
        ],
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.todos,
    required this.diffStats,
    required this.isExecuting,
    required this.isError,
    required this.isSearch,
    required this.isGrep,
    required this.searchResultCount,
    required this.grepMatchCount,
  });

  final List<_Todo>? todos;
  final PersonaDiffStats? diffStats;
  final bool isExecuting;
  final bool isError;
  final bool isSearch;
  final bool isGrep;
  final int searchResultCount;
  final int grepMatchCount;

  @override
  Widget build(BuildContext context) {
    if (todos != null) return const SizedBox.shrink();
    if (diffStats != null) {
      return Text.rich(
        TextSpan(
          children: [
            TextSpan(text: '+${diffStats!.added} ', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 11)),
            TextSpan(text: '-${diffStats!.removed}', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 11)),
          ],
        ),
      );
    }
    if (isExecuting) {
      return const SizedBox(
        width: 12,
        height: 12,
        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.blue),
      );
    }
    if (isError) return const Icon(Icons.error_outline, size: 14, color: Colors.red);
    if (isSearch && searchResultCount > 0) return _Badge(text: '$searchResultCount results');
    if (isGrep && grepMatchCount > 0) return _Badge(text: '$grepMatchCount matches');
    return const Icon(Icons.check_circle_outline, size: 14, color: Colors.green);
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: Colors.blue.shade700, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }
}

class _PresentFileCard extends StatelessWidget {
  const _PresentFileCard({required this.toolCall, required this.args, this.onOpenFile});

  final PersonaToolCall toolCall;
  final Map<String, dynamic> args;
  final ValueChanged<String>? onOpenFile;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final filePath = (args['filePath'] ?? args['path'] ?? '').toString();
    final fileName = filePath.split('/').isEmpty ? filePath : filePath.split('/').last;
    final description = (args['description'] ?? '').toString();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: theme.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: theme.border)),
      child: Row(
        children: [
          Icon(Icons.description_outlined, size: 18, color: theme.text.withValues(alpha: 0.6)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(fileName.isEmpty ? 'file' : fileName, style: TextStyle(color: theme.text, fontSize: 13, fontWeight: FontWeight.w600)),
                if (description.isNotEmpty || filePath.isNotEmpty)
                  Text(
                    description.isNotEmpty ? description : filePath,
                    style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (filePath.isNotEmpty)
            OutlinedButton(onPressed: () => onOpenFile?.call(filePath), child: const Text('Open')),
        ],
      ),
    );
  }
}

class _Todo {
  const _Todo({required this.content, required this.status});
  final String content;
  final String status;
}

class _TodoChecklist extends StatelessWidget {
  const _TodoChecklist({required this.todos});
  final List<_Todo> todos;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final todo in todos)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  todo.status == 'completed'
                      ? Icons.check_circle
                      : todo.status == 'in_progress'
                      ? Icons.pending_outlined
                      : Icons.circle_outlined,
                  size: 15,
                  color: todo.status == 'completed'
                      ? Colors.blue
                      : todo.status == 'in_progress'
                      ? Colors.blue.shade300
                      : theme.text.withValues(alpha: 0.3),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    todo.content,
                    style: TextStyle(
                      color: todo.status == 'completed' ? theme.text.withValues(alpha: 0.4) : theme.text,
                      fontSize: 12.5,
                      decoration: todo.status == 'completed' ? TextDecoration.lineThrough : null,
                      fontWeight: todo.status == 'in_progress' ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CodeBlock extends StatelessWidget {
  const _CodeBlock({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(10)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Text(text, style: const TextStyle(color: Color(0xFFE6EDF2), fontSize: 11, fontFamily: 'monospace')),
      ),
    );
  }
}

List<_Todo>? _parseTodos(Map<String, dynamic> args, Object? result) {
  List<dynamic>? raw;
  if (result is Map) {
    final update = result['update'];
    if (update is Map && update['todos'] is List) {
      raw = update['todos'] as List;
    } else if (result['todos'] is List) {
      raw = result['todos'] as List;
    }
  }
  raw ??= args['todos'] is List ? args['todos'] as List : null;
  if (raw == null) return null;

  final todos = raw
      .whereType<Map>()
      .map((t) => _Todo(content: (t['content'] ?? '').toString(), status: (t['status'] ?? 'pending').toString()))
      .where((t) => t.content.isNotEmpty)
      .toList();
  return todos.isEmpty ? null : todos;
}

Object? _tryDecode(String? value) {
  if (value == null) return null;
  try {
    return jsonDecode(value);
  } catch (_) {
    return value;
  }
}
