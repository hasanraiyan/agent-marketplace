import 'dart:convert';

import 'package:flutter/material.dart';

/// Humanized titles + semantic icons + result parsing for the built-in
/// tools every deepagents-based Persona agent ships with (file ops, web/KB
/// search, grep, todos, subagents). Ported from `sdk/ui/src/utils/
/// toolPresentation.ts`, which was itself ported from persona.hasanraiyan.me's
/// own frontend, so a tool call renders with the same per-tool presentation
/// across web, Flutter, and the reference site.

Map<String, dynamic> _asMap(Object? value) => value is Map<String, dynamic> ? value : const {};

String _firstString(Map<String, dynamic> args, List<String> keys) {
  for (final key in keys) {
    final value = args[key];
    if (value is String && value.isNotEmpty) return value;
  }
  return '';
}

bool isWebSearchTool(String name) {
  final n = name.toLowerCase();
  return n == 'search_web' || n.contains('google') || n.startsWith('tavily');
}

bool isKbSearchTool(String name) {
  final n = name.toLowerCase();
  return !isWebSearchTool(name) && (n == 'search_knowledge_base' || (n.startsWith('search_') && n != 'search_web'));
}

bool isKbListSourcesTool(String name) {
  final n = name.toLowerCase();
  return n == 'list_knowledge_base_sources' || n.startsWith('list_sources_');
}

bool isGrepTool(String name) => name.toLowerCase().contains('grep');

bool isReadFileTool(String name) {
  final n = name.toLowerCase();
  return n == 'read_file' || n == 'view_file' || n.contains('read_file') || n.contains('view_file');
}

bool isLsTool(String name) {
  final n = name.toLowerCase();
  return n == 'ls' || n == 'list_dir' || n == 'list_directory' || n.contains('list_dir') || n.contains('list_directory');
}

bool isFileWriteTool(String name) => name.toLowerCase() == 'write_file';

bool isFileEditTool(String name) => name.toLowerCase() == 'edit_file';

bool isSubagentTool(String name) => name.toLowerCase() == 'task';

bool isTodoTool(String name) => name.toLowerCase().contains('todo');

IconData getToolIcon(String toolName) {
  final n = toolName.toLowerCase();
  if (isWebSearchTool(toolName)) return Icons.public;
  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) return Icons.menu_book_rounded;
  if (isGrepTool(toolName)) return Icons.search;
  if (n.contains('todo')) return Icons.checklist_rounded;
  if (isSubagentTool(toolName)) return Icons.smart_toy_outlined;
  if (isReadFileTool(toolName) || isLsTool(toolName) || isFileWriteTool(toolName) || isFileEditTool(toolName) || n.contains('file')) {
    return Icons.description_outlined;
  }
  return Icons.build_outlined;
}

String queryFromArgs(Map<String, dynamic> args) => _firstString(args, ['query', 'q', 'search_query', 'text', 'input']);

String getToolTitle(String toolName, Map<String, dynamic> args, {required bool done}) {
  final query = queryFromArgs(args);

  if (isWebSearchTool(toolName)) {
    if (query.isNotEmpty) return done ? 'Searched the web for "$query"' : 'Searching the web for "$query"';
    return done ? 'Searched the web' : 'Searching the web';
  }

  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) {
    final kbName = _firstString(args, ['knowledgeBaseName']).isEmpty ? 'Knowledge Base' : args['knowledgeBaseName'] as String;
    final isSearch = !isKbListSourcesTool(toolName);
    final kbQuery = _firstString(args, ['query']).isEmpty ? query : args['query'] as String;
    if (isSearch) {
      if (kbQuery.isNotEmpty) {
        return done ? 'Searched knowledge base "$kbName" for "$kbQuery"' : 'Searching knowledge base "$kbName" for "$kbQuery"';
      }
      return done ? 'Searched knowledge base "$kbName"' : 'Searching knowledge base "$kbName"';
    }
    return done ? 'Listed documents in "$kbName"' : 'Listing documents in "$kbName"';
  }

  if (toolName.toLowerCase().contains('todo')) {
    return done ? 'Updated the plan' : 'Updating the plan';
  }

  if (isReadFileTool(toolName)) return done ? 'Read file' : 'Reading file';
  if (isLsTool(toolName)) return done ? 'Listed directory' : 'Listing directory';

  if (isSubagentTool(toolName)) {
    final subagentType = _firstString(args, ['subagent_type']);
    final label = subagentType.isEmpty ? 'subagent' : '$subagentType subagent';
    return done ? 'Ran $label' : 'Running $label';
  }

  if (toolName.toLowerCase().contains('file') || toolName.toLowerCase() == 'glob') {
    return done ? 'Updated files' : 'Working with files';
  }

  return toolName
      .split(RegExp(r'[_\-\s]'))
      .where((w) => w.isNotEmpty)
      .map((w) => w[0].toUpperCase() + w.substring(1))
      .join(' ');
}

String getDomain(String url) {
  try {
    final host = Uri.parse(url).host;
    return host.startsWith('www.') ? host.substring(4) : host;
  } catch (_) {
    return url;
  }
}

class PersonaSearchResult {
  const PersonaSearchResult({this.title, this.url});
  final String? title;
  final String? url;
}

List<PersonaSearchResult> searchResults(Object? result) {
  final decoded = _tryDecode(result);
  final list = decoded is List
      ? decoded
      : (decoded is Map && decoded['results'] is List)
      ? decoded['results'] as List
      : const [];
  return list.whereType<Map>().map((m) {
    final map = m.cast<String, dynamic>();
    return PersonaSearchResult(title: map['title'] as String?, url: map['url'] as String?);
  }).toList();
}

class PersonaLsEntry {
  const PersonaLsEntry({required this.name, required this.isDir});
  final String name;
  final bool isDir;
}

List<PersonaLsEntry> parseLsResults(String? resultText) {
  if (resultText == null || resultText.isEmpty) return const [];
  final decoded = _tryDecode(resultText);
  if (decoded is List) {
    return decoded.map((item) {
      if (item is String) {
        final isDir = item.endsWith('/') || item.contains('(directory)');
        return PersonaLsEntry(name: item.replaceAll('(directory)', '').trim(), isDir: isDir);
      }
      final map = _asMap(item);
      return PersonaLsEntry(
        name: (map['name'] ?? map['path'] ?? '').toString(),
        isDir: map['isDir'] == true || map['is_dir'] == true || map['isDirectory'] == true,
      );
    }).toList();
  }

  return resultText
      .split('\n')
      .map((l) => l.trim())
      .where((l) => l.isNotEmpty)
      .map((line) {
        final isDir = line.endsWith('/') || line.toLowerCase().contains('(directory)') || line.toLowerCase().contains('(dir)');
        final name = line.replaceAll(RegExp(r'\(directory\)', caseSensitive: false), '').replaceAll(RegExp(r'\(dir\)', caseSensitive: false), '').trim();
        return PersonaLsEntry(name: name, isDir: isDir);
      })
      .toList();
}

class PersonaGrepMatch {
  const PersonaGrepMatch({required this.file, required this.line, required this.content});
  final String file;
  final int line;
  final String content;
}

List<PersonaGrepMatch> parseGrepResults(String? resultText) {
  if (resultText == null || resultText.isEmpty) return const [];
  final decoded = _tryDecode(resultText);
  final matches = decoded is List ? decoded : (decoded is Map && decoded['matches'] is List) ? decoded['matches'] as List : null;
  if (matches != null) {
    return matches.whereType<Map>().map((m) {
      final map = m.cast<String, dynamic>();
      final file = (map['Filename'] ?? map['filename'] ?? map['file'] ?? map['path'] ?? '').toString();
      final line = int.tryParse((map['LineNumber'] ?? map['lineNumber'] ?? map['line'] ?? 0).toString()) ?? 0;
      final content = (map['LineContent'] ?? map['lineContent'] ?? map['content'] ?? '').toString();
      return PersonaGrepMatch(file: file, line: line, content: content);
    }).where((m) => m.file.isNotEmpty).toList();
  }

  final out = <PersonaGrepMatch>[];
  var currentFile = '';
  for (final raw in resultText.split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) continue;
    if (line.endsWith(':') && !RegExp(r'^\d+:').hasMatch(line)) {
      currentFile = line.substring(0, line.length - 1).trim();
    } else if (currentFile.isNotEmpty) {
      final match = RegExp(r'^(\d+):(.*)$').firstMatch(line);
      if (match != null) {
        out.add(PersonaGrepMatch(file: currentFile, line: int.parse(match.group(1)!), content: match.group(2)!));
      } else {
        out.add(PersonaGrepMatch(file: currentFile, line: 0, content: line));
      }
    }
  }
  return out;
}

enum DiffRowType { context, add, remove }

class DiffRow {
  const DiffRow(this.type, this.line);
  final DiffRowType type;
  final String line;
}

/// Bounded LCS diff — falls back to naive remove-then-add when either side
/// is too large for O(n*m) DP to stay fast.
List<DiffRow> computeLineDiff(List<String> oldLines, List<String> newLines) {
  final n = oldLines.length;
  final m = newLines.length;
  if (n * m > 250000) {
    return [
      ...oldLines.map((l) => DiffRow(DiffRowType.remove, l)),
      ...newLines.map((l) => DiffRow(DiffRowType.add, l)),
    ];
  }

  final dp = List.generate(n + 1, (_) => List<int>.filled(m + 1, 0));
  for (var i = n - 1; i >= 0; i--) {
    for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] == newLines[j] ? dp[i + 1][j + 1] + 1 : (dp[i + 1][j] > dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1]);
    }
  }

  final rows = <DiffRow>[];
  var i = 0, j = 0;
  while (i < n && j < m) {
    if (oldLines[i] == newLines[j]) {
      rows.add(DiffRow(DiffRowType.context, oldLines[i]));
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.add(DiffRow(DiffRowType.remove, oldLines[i]));
      i++;
    } else {
      rows.add(DiffRow(DiffRowType.add, newLines[j]));
      j++;
    }
  }
  while (i < n) {
    rows.add(DiffRow(DiffRowType.remove, oldLines[i++]));
  }
  while (j < m) {
    rows.add(DiffRow(DiffRowType.add, newLines[j++]));
  }
  return rows;
}

class PersonaDiffStats {
  const PersonaDiffStats({required this.added, required this.removed});
  final int added;
  final int removed;
}

PersonaDiffStats? computeFileDiffStats(String toolName, Map<String, dynamic> args) {
  if (isFileWriteTool(toolName)) {
    final content = args['content'];
    if (content is! String) return null;
    return PersonaDiffStats(added: content.split('\n').length, removed: 0);
  }

  if (isFileEditTool(toolName)) {
    final oldString = args['old_string'];
    final newString = args['new_string'];
    if (oldString is! String && newString is! String) return null;
    final rows = computeLineDiff(
      (oldString as String? ?? '').split('\n'),
      (newString as String? ?? '').split('\n'),
    );
    return PersonaDiffStats(
      added: rows.where((r) => r.type == DiffRowType.add).length,
      removed: rows.where((r) => r.type == DiffRowType.remove).length,
    );
  }

  return null;
}

String getFilePathFromArgs(Map<String, dynamic> args) =>
    _firstString(args, ['file_path', 'filePath', 'path', 'filename', 'fileName', 'targetFile', 'target_file']);

Object? _tryDecode(Object? value) {
  if (value is! String) return value;
  try {
    return jsonDecode(value);
  } catch (_) {
    return null;
  }
}
