import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

/// Which semantic family a tool belongs to, for a cluster header — ported
/// from `sdk/ui/src/utils/toolGrouping.ts`.
String toolGroupKey(PersonaToolCall tool) {
  final name = tool.toolName.toLowerCase();
  if (name.contains('memory') || name.contains('preference')) return 'memory';
  Map<String, dynamic> args = const {};
  if (tool.args != null) {
    try {
      final decoded = jsonDecode(tool.args!);
      if (decoded is Map<String, dynamic>) args = decoded;
    } catch (_) {}
  }
  final path = args['file_path'] ?? args['path'] ?? args['filePath'];
  if (path is String && path.contains('/memories')) return 'memory';
  if (name.contains('file') || name == 'ls' || name == 'glob' || name == 'grep') return 'file';
  if (name.contains('search') || name.startsWith('tavily')) return 'search';
  if (name == 'task') return 'task';
  if (name.contains('todo')) return 'plan';
  return name;
}

class PersonaToolClusterMeta {
  const PersonaToolClusterMeta({required this.title, required this.icon});
  final String title;
  final IconData icon;
}

const Map<String, PersonaToolClusterMeta> defaultClusterLabels = {
  'memory': PersonaToolClusterMeta(title: 'Personalizing memory', icon: Icons.psychology_outlined),
  'file': PersonaToolClusterMeta(title: 'Working with files', icon: Icons.description_outlined),
  'search': PersonaToolClusterMeta(title: 'Searching the web', icon: Icons.public),
  'task': PersonaToolClusterMeta(title: 'Running subagents', icon: Icons.smart_toy_outlined),
  'plan': PersonaToolClusterMeta(title: 'Updating the plan', icon: Icons.checklist_rounded),
  'mixed': PersonaToolClusterMeta(title: 'Performing actions', icon: Icons.build_outlined),
};

PersonaToolClusterMeta clusterMeta(List<PersonaToolCall> tools, {Map<String, PersonaToolClusterMeta>? labels}) {
  final merged = {...defaultClusterLabels, ...?labels};
  final groups = tools.map(toolGroupKey).toSet();
  final key = groups.length == 1 ? groups.first : 'mixed';
  return merged[key] ?? merged['mixed']!;
}

sealed class PersonaToolGroupItem {
  const PersonaToolGroupItem();
}

class PersonaToolGroupSingle extends PersonaToolGroupItem {
  const PersonaToolGroupSingle(this.tool);
  final PersonaToolCall tool;
}

class PersonaToolGroupCluster extends PersonaToolGroupItem {
  const PersonaToolGroupCluster(this.tools);
  final List<PersonaToolCall> tools;
}

/// Clusters consecutive tool calls from one message into groups a
/// `PersonaToolGroup` can render as one collapsible unit — `present_file`
/// never joins a group, since its whole purpose is "highlight this file".
List<PersonaToolGroupItem> groupToolCalls(List<PersonaToolCall> toolCalls) {
  final items = <PersonaToolGroupItem>[];
  var buffer = <PersonaToolCall>[];

  void flush() {
    if (buffer.isEmpty) return;
    items.add(buffer.length == 1 ? PersonaToolGroupSingle(buffer.single) : PersonaToolGroupCluster(buffer));
    buffer = [];
  }

  for (final tool in toolCalls) {
    if (tool.toolName == 'present_file') {
      flush();
      items.add(PersonaToolGroupSingle(tool));
    } else {
      buffer.add(tool);
    }
  }
  flush();
  return items;
}
