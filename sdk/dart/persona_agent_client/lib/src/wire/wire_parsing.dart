import 'dart:convert';

import '../models/models.dart';

/// Free functions handling wire-shape quirks too custom/conditional for a
/// `@JsonKey`/generated `fromJson` — direct ports of `useChat.ts`'s own
/// module-level helpers of the same names, kept here (not inlined into
/// [PersonaChatController]) so they stay independently unit-testable.

/// Unwraps a REST response body's envelope into the item list it carries,
/// tolerating the few shapes agent-backend's list endpoints actually use:
/// `{data:{items:[...]}}`, `{items:[...]}`, `{data:[...]}`, or a bare
/// `[...]`. Every list-returning CRUD controller in this package goes
/// through this rather than assuming one fixed shape.
List<dynamic> extractListEnvelope(Object? body, {String itemsKey = 'items'}) {
  var current = body;
  if (current is Map<String, dynamic> && current.containsKey('data')) {
    current = current['data'];
  }
  if (current is Map<String, dynamic> && current[itemsKey] is List) {
    return current[itemsKey] as List<dynamic>;
  }
  if (current is List) return current;
  return const [];
}

/// `STATE_SNAPSHOT`'s raw `files` map (and the reload path's `state.files`)
/// arrives keyed by path with snake_case fields
/// (`{content,size,created_at,modified_at}`) — normalizes into the clean
/// [PersonaWorkspaceFile] shape this client's state carries everywhere else.
Map<String, PersonaWorkspaceFile> normalizeWorkspaceFiles(Map<String, dynamic> raw) {
  final result = <String, PersonaWorkspaceFile>{};
  for (final entry in raw.entries) {
    final value = entry.value;
    if (value is! Map) continue;
    final map = value.cast<String, dynamic>();
    result[entry.key] = PersonaWorkspaceFile(
      content: map['content'] as String? ?? '',
      size: (map['size'] as num?)?.toInt() ?? 0,
      createdAt: map['created_at'] as String?,
      modifiedAt: map['modified_at'] as String?,
    );
  }
  return result;
}

/// Both the live `hitl_request`/`clarification_request` CUSTOM events and
/// `GET /threads/:id/messages`'s `pendingInterrupt` field carry the same
/// `{kind, value}` envelope — flattens it into a [PersonaInterrupt], or
/// `null` if `raw` isn't that shape (e.g. the thread isn't currently
/// paused).
PersonaInterrupt? normalizePendingInterrupt(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  final kind = raw['kind'] as String?;
  final value = raw['value'] as Map<String, dynamic>?;
  if (kind == null || value == null) return null;
  try {
    return PersonaInterrupt.fromEnvelope(kind, value);
  } on ArgumentError {
    return null;
  }
}

/// The folded/paired shape agent-backend persists for a subagent's activity
/// (`subagentTraces`, keyed by the owning `task` tool call's `toolCallId`) —
/// `{type:'text',text}` or `{type:'tool',name,argsText,resultText,status}` —
/// is DIFFERENT from the raw kind-based [PersonaSubagentActivityEntry] shape
/// the live stream produces. Re-expands the folded shape back into the same
/// kind-based entries, so a reloaded thread's subagent activity renders
/// identically to a live run (see agent-backend's `subagentTrace.js` for the
/// server-side fold this reverses).
List<PersonaSubagentActivityEntry> persistedTraceToActivityEntries(List<dynamic> items) {
  final entries = <PersonaSubagentActivityEntry>[];
  for (final raw in items) {
    if (raw is! Map<String, dynamic>) continue;
    final type = raw['type'] as String?;
    if (type == 'text') {
      final text = raw['text'] as String? ?? '';
      if (text.isNotEmpty) {
        entries.add(PersonaSubagentActivityEntry(kind: PersonaSubagentActivityKind.text, delta: text));
      }
    } else if (type == 'tool') {
      final name = raw['name'] as String? ?? '';
      entries.add(
        PersonaSubagentActivityEntry(
          kind: PersonaSubagentActivityKind.toolStart,
          toolName: name,
          args: raw['argsText'] as String?,
        ),
      );
      if (raw['status'] == 'completed') {
        entries.add(
          PersonaSubagentActivityEntry(
            kind: PersonaSubagentActivityKind.toolResult,
            toolName: name,
            result: raw['resultText'] as String?,
          ),
        );
      }
    }
  }
  return entries;
}

/// A failed tool call's `TOOL_CALL_RESULT` content is a JSON envelope
/// (`{status:'error',message}`) rather than a separate boolean field on the
/// event itself.
bool isErrorToolContent(String content) {
  final trimmed = content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    final parsed = jsonDecode(content);
    return parsed is Map && parsed['status'] == 'error';
  } catch (_) {
    return false;
  }
}

/// `present_file`'s result is `{status:'success', filePath, title?,
/// description?}` — a signal to highlight that path in the workspace files
/// panel, not something meant to render as a generic tool-result blob.
PersonaPresentedFile? parsePresentedFile(String content) {
  try {
    final parsed = jsonDecode(content);
    if (parsed is! Map || parsed['status'] != 'success') return null;
    final filePath = parsed['filePath'];
    if (filePath is! String) return null;
    final title = parsed['title'];
    final description = parsed['description'];
    return PersonaPresentedFile(
      path: filePath,
      title: title is String ? title : filePath,
      description: description is String ? description : '',
    );
  } catch (_) {
    return null;
  }
}
