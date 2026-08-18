import type { PersonaSubagentActivityEntry, PersonaToolCall } from '@personaai/react';

/**
 * Turns a subagent's raw activity stream (separate `tool_start`/`tool_result`
 * events with no shared id — see `PersonaSubagentActivityEntry`) into the
 * same paired `{args, result}` shape `PersonaToolCall` already has, so a
 * subagent's own tool calls can be rendered with the exact same
 * `PersonaToolTrace` cards (search results, diffs, read-file, ...) as the
 * top-level transcript instead of a flat text line. Ported from
 * persona.hasanraiyan.me's own frontend, which already stores its
 * `tool.subEvents` pre-paired at the point they're captured — sdk/react's
 * event reducer doesn't, so the pairing has to happen here instead.
 */

export type PersonaSubagentTimelineItem =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolCall: PersonaToolCall };

export function buildSubagentTimeline(entries: PersonaSubagentActivityEntry[]): PersonaSubagentTimelineItem[] {
  const items: PersonaSubagentTimelineItem[] = [];
  const openByName = new Map<string, PersonaToolCall[]>();
  let counter = 0;

  for (const entry of entries) {
    if (entry.kind === 'text') {
      const last = items[items.length - 1];
      if (last?.kind === 'text') {
        last.text += entry.delta || '';
      } else {
        items.push({ kind: 'text', text: entry.delta || '' });
      }
      continue;
    }

    if (entry.kind === 'tool_start') {
      const toolCall: PersonaToolCall = {
        toolCallId: `subagent-tool-${counter++}`,
        toolName: entry.toolName || 'tool',
        args: entry.args,
      };
      items.push({ kind: 'tool', toolCall });
      const name = entry.toolName || '';
      const queue = openByName.get(name) ?? [];
      queue.push(toolCall);
      openByName.set(name, queue);
      continue;
    }

    // tool_result — match the oldest still-open call with the same name
    // (FIFO). A subagent's ReAct loop is normally sequential, so this is
    // almost always the very last item pushed; the queue only matters for
    // the rare case of overlapping calls to the same tool.
    const name = entry.toolName || '';
    const queue = openByName.get(name);
    const target = queue?.shift();
    if (target) {
      target.result = entry.result;
    } else {
      items.push({
        kind: 'tool',
        toolCall: { toolCallId: `subagent-tool-${counter++}`, toolName: name || 'tool', result: entry.result },
      });
    }
  }

  return items;
}

export type PersonaSubagentStatus = 'running' | 'completed' | 'failed' | 'denied' | 'canceled';

function safeParse(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Mirrors the reference frontend's getSubagentStatus — completed with an empty
 * result reads as "canceled", an error result mentioning denial/rejection reads
 * as "denied" rather than a generic "failed". */
export function classifySubagentStatus(toolCall: PersonaToolCall, isLive: boolean): PersonaSubagentStatus {
  const isExecuting = isLive && !toolCall.result && !toolCall.isError;
  if (isExecuting) return 'running';

  if (toolCall.isError) {
    const parsed = safeParse(toolCall.result);
    const message = String(
      (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).message) ||
        toolCall.result ||
        ''
    ).toLowerCase();
    if (/denied|reject|declin/.test(message)) return 'denied';
    return 'failed';
  }

  if (!toolCall.result) return 'canceled';
  return 'completed';
}
