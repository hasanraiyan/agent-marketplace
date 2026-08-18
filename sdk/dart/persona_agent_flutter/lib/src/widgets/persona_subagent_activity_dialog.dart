import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import '../utils/subagent_timeline.dart';
import 'persona_markdown.dart';
import 'persona_tool_trace.dart';

const Map<PersonaSubagentStatus, ({String label, IconData icon, Color color})> _statusMeta = {
  PersonaSubagentStatus.running: (label: 'Running', icon: Icons.autorenew, color: Colors.orange),
  PersonaSubagentStatus.completed: (label: 'Completed', icon: Icons.check, color: Colors.green),
  PersonaSubagentStatus.failed: (label: 'Failed', icon: Icons.close, color: Colors.red),
  PersonaSubagentStatus.denied: (label: 'Denied', icon: Icons.block, color: Colors.grey),
  PersonaSubagentStatus.canceled: (label: 'Canceled', icon: Icons.block, color: Colors.grey),
};

/// Detail view for a `task` (subagent) tool call — goal, type, outcome, and
/// the subagent's own timeline with its tool calls rendered as full,
/// recursive [PersonaToolTrace] cards. Opened by tapping a `task` tool's
/// row in [PersonaToolTrace]. Mirrors `PersonaSubagentActivityDialog.tsx`.
class PersonaSubagentActivityDialog extends StatelessWidget {
  const PersonaSubagentActivityDialog({
    super.key,
    required this.toolCall,
    this.toolRenderers,
    this.onOpenFile,
    this.isLive = false,
  });

  final PersonaToolCall toolCall;
  final Map<String, PersonaToolRenderer>? toolRenderers;
  final ValueChanged<String>? onOpenFile;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    Map<String, dynamic> args = const {};
    if (toolCall.args != null) {
      try {
        final decoded = jsonDecode(toolCall.args!);
        if (decoded is Map<String, dynamic>) args = decoded;
      } catch (_) {}
    }
    final goal = (args['description'] ?? args['task'] ?? args['goal'] ?? 'Subagent task').toString();
    final subagentType = args['subagent_type'] ?? args['subagentType'];
    final status = classifySubagentStatus(toolCall, isLive: isLive);
    final meta = _statusMeta[status]!;
    final timeline = toolCall.subagentActivity != null
        ? buildSubagentTimeline(toolCall.subagentActivity!)
        : const <PersonaSubagentTimelineItem>[];

    return Dialog(
      backgroundColor: theme.background,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 640),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: theme.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (subagentType != null)
                          Text(
                            '$subagentType subagent',
                            style: TextStyle(color: theme.text.withValues(alpha: 0.5), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        Text(goal, style: TextStyle(color: theme.text, fontSize: 14, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: meta.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(meta.icon, size: 14, color: meta.color),
                        const SizedBox(width: 4),
                        Text(meta.label, style: TextStyle(color: meta.color, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                ],
              ),
            ),
            Flexible(
              child: timeline.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(32),
                      child: Center(
                        child: Text(
                          status == PersonaSubagentStatus.running ? 'Waiting for activity…' : 'No activity recorded.',
                          style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 12, fontStyle: FontStyle.italic),
                        ),
                      ),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final item in timeline)
                            switch (item) {
                              PersonaSubagentTextItem(text: final text) when text.trim().isNotEmpty => Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: PersonaMarkdown(content: text),
                              ),
                              PersonaSubagentTextItem() => const SizedBox.shrink(),
                              PersonaSubagentToolItem(toolCall: final tc) => PersonaToolTrace(
                                toolCall: tc,
                                toolRenderers: toolRenderers,
                                onOpenFile: onOpenFile,
                                isLive: isLive,
                              ),
                            },
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
