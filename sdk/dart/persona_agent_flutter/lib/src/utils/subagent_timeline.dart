import 'package:persona_agent_client/persona_agent_client.dart';

/// Turns a subagent's raw activity stream (separate `tool_start`/
/// `tool_result` entries with no shared id) into the same paired
/// `PersonaToolCall` shape the main transcript already uses, so a
/// subagent's own tool calls can be rendered with the exact same
/// `PersonaToolTrace` cards (search results, diffs, read-file, ...) instead
/// of a flat text line. Ported from `sdk/ui`'s `buildSubagentTimeline`.
sealed class PersonaSubagentTimelineItem {
  const PersonaSubagentTimelineItem();
}

class PersonaSubagentTextItem extends PersonaSubagentTimelineItem {
  const PersonaSubagentTextItem(this.text);
  final String text;
}

class PersonaSubagentToolItem extends PersonaSubagentTimelineItem {
  const PersonaSubagentToolItem(this.toolCall);
  final PersonaToolCall toolCall;
}

List<PersonaSubagentTimelineItem> buildSubagentTimeline(List<PersonaSubagentActivityEntry> entries) {
  final items = <PersonaSubagentTimelineItem>[];
  final openByName = <String, List<PersonaToolCall>>{};
  var counter = 0;

  for (final entry in entries) {
    switch (entry.kind) {
      case PersonaSubagentActivityKind.text:
        final last = items.isNotEmpty ? items.last : null;
        if (last is PersonaSubagentTextItem) {
          items[items.length - 1] = PersonaSubagentTextItem(last.text + (entry.delta ?? ''));
        } else {
          items.add(PersonaSubagentTextItem(entry.delta ?? ''));
        }

      case PersonaSubagentActivityKind.toolStart:
        final toolCall = PersonaToolCall(
          toolCallId: 'subagent-tool-${counter++}',
          toolName: entry.toolName ?? 'tool',
          args: entry.args,
        );
        items.add(PersonaSubagentToolItem(toolCall));
        (openByName[entry.toolName ?? ''] ??= []).add(toolCall);

      case PersonaSubagentActivityKind.toolResult:
        final name = entry.toolName ?? '';
        final queue = openByName[name];
        if (queue != null && queue.isNotEmpty) {
          final target = queue.removeAt(0);
          final index = items.indexWhere(
            (item) => item is PersonaSubagentToolItem && identical(item.toolCall, target),
          );
          if (index != -1) {
            items[index] = PersonaSubagentToolItem(target.copyWith(result: entry.result));
          }
        } else {
          items.add(
            PersonaSubagentToolItem(
              PersonaToolCall(toolCallId: 'subagent-tool-${counter++}', toolName: name.isEmpty ? 'tool' : name, result: entry.result),
            ),
          );
        }
    }
  }

  return items;
}

enum PersonaSubagentStatus { running, completed, failed, denied, canceled }

/// Mirrors the reference frontend's `getSubagentStatus`: completed with an
/// empty result reads as "canceled", an error result mentioning denial/
/// rejection reads as "denied" rather than a generic "failed".
PersonaSubagentStatus classifySubagentStatus(PersonaToolCall toolCall, {required bool isLive}) {
  final isExecuting = isLive && toolCall.result == null && !toolCall.isError;
  if (isExecuting) return PersonaSubagentStatus.running;

  if (toolCall.isError) {
    final message = (toolCall.result ?? '').toLowerCase();
    if (message.contains('denied') || message.contains('reject') || message.contains('declin')) {
      return PersonaSubagentStatus.denied;
    }
    return PersonaSubagentStatus.failed;
  }

  if (toolCall.result == null || toolCall.result!.isEmpty) return PersonaSubagentStatus.canceled;
  return PersonaSubagentStatus.completed;
}
