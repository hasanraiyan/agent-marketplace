import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import '../utils/tool_grouping.dart';
import 'persona_tool_trace.dart';

/// A run of adjacent tool calls collapses into ONE cluster with a header
/// derived from what the mix is doing — "Working with files", "Searching
/// the web" — instead of a generic "Used N tools". Mirrors
/// `PersonaToolGroup.tsx`.
class PersonaToolGroup extends StatefulWidget {
  const PersonaToolGroup({
    super.key,
    required this.tools,
    this.toolRenderers,
    this.onOpenFile,
    this.clusterLabels,
    this.isLive = false,
  });

  final List<PersonaToolCall> tools;
  final Map<String, PersonaToolRenderer>? toolRenderers;
  final ValueChanged<String>? onOpenFile;
  final Map<String, PersonaToolClusterMeta>? clusterLabels;

  /// See [PersonaToolTrace.isLive].
  final bool isLive;

  @override
  State<PersonaToolGroup> createState() => _PersonaToolGroupState();
}

class _PersonaToolGroupState extends State<PersonaToolGroup> {
  late bool _isOpen = _anyRunning;
  bool _wasRunning = false;

  bool get _anyRunning => widget.isLive && widget.tools.any((t) => t.result == null && !t.isError);

  @override
  void didUpdateWidget(covariant PersonaToolGroup oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Auto-open the moment any step in the group starts running, so the
    // user sees it happen live — never auto-*close* on completion, so a
    // card the user opened to read stays open once the run settles.
    final running = _anyRunning;
    if (running && !_wasRunning) setState(() => _isOpen = true);
    _wasRunning = running;
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final hasError = widget.tools.any((t) => t.isError);
    final anyRunning = _anyRunning;
    final meta = clusterMeta(widget.tools, labels: widget.clusterLabels);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => setState(() => _isOpen = !_isOpen),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Row(
                children: [
                  if (anyRunning)
                    const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.blue))
                  else if (hasError)
                    const Icon(Icons.error_outline, size: 16, color: Colors.red)
                  else
                    const Icon(Icons.check_circle_outline, size: 16, color: Colors.green),
                  const SizedBox(width: 8),
                  Icon(meta.icon, size: 16, color: theme.text.withValues(alpha: 0.5)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(meta.title, style: TextStyle(color: theme.text.withValues(alpha: 0.7), fontSize: 12, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                  ),
                  Text(
                    '${widget.tools.length} step${widget.tools.length > 1 ? 's' : ''}',
                    style: TextStyle(color: theme.text.withValues(alpha: 0.35), fontSize: 10),
                  ),
                  Icon(_isOpen ? Icons.expand_less : Icons.expand_more, size: 16, color: theme.text.withValues(alpha: 0.4)),
                ],
              ),
            ),
          ),
          if (_isOpen)
            Padding(
              padding: const EdgeInsets.only(left: 16, top: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final tool in widget.tools)
                    PersonaToolTrace(
                      key: ValueKey(tool.toolCallId),
                      toolCall: tool,
                      toolRenderers: widget.toolRenderers,
                      onOpenFile: widget.onOpenFile,
                      isLive: widget.isLive,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
