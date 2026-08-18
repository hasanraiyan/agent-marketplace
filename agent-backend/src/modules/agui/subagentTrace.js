/**
 * Server-side fold of `subagent_activity` stream events into the same timeline
 * item shape the client builds live (see appendSubEvent in the frontend's
 * use-agui-chat.js): { type: 'text', text } and
 * { type: 'tool', name, argsText, resultText, status }.
 *
 * Folding server-side (instead of storing raw per-token events) keeps the
 * persisted trace compact: contiguous text deltas merge into one item.
 */
export function foldSubagentEvent(items, value) {
  const kind = value?.kind;

  if (kind === 'text' || kind === undefined) {
    const delta = typeof value?.delta === 'string' ? value.delta : '';
    if (!delta) return;
    const last = items[items.length - 1];
    if (last?.type === 'text') {
      last.text += delta;
    } else {
      items.push({ type: 'text', text: delta });
    }
  } else if (kind === 'tool_start') {
    items.push({
      type: 'tool',
      name: value?.toolName || 'tool',
      argsText: typeof value?.args === 'string' ? value.args : '',
      resultText: '',
      status: 'running',
    });
  } else if (kind === 'tool_result') {
    // Complete the most recent still-running call of this tool.
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      if (item.type === 'tool' && item.status === 'running' && item.name === value?.toolName) {
        item.resultText = typeof value?.result === 'string' ? value.result : '';
        item.status = 'completed';
        break;
      }
    }
  }
}

// The run is over — nothing inside a trace can still be executing.
export function settleTrace(items) {
  for (const item of items) {
    if (item.type === 'tool' && item.status === 'running') {
      item.status = 'completed';
    }
  }
  return items;
}

// The live stream's own toolCallId for a `task` call (bound from a
// tool_call_chunk's id, or a LangChain run_id fallback when the provider
// never streamed one — see aguiTranslator.js's `streamedId || event.run_id`)
// can end up DIFFERENT from that same call's `tool_calls[].id` once
// LangGraph/the provider adapter finishes assembling and persisting the
// checkpoint. Root cause is provider-adapter-internal (confirmed for at
// least @langchain/google-genai: it can synthesize a fresh id per streamed
// chunk rather than reusing one) and not reliably fixable by watching the
// stream more closely — the checkpoint's id is the only value BOTH the live
// fold (this file) and the reload path (checkpoint.service.js) can agree on
// after the fact. Extracts every `task` tool call's real id, in the order
// it appears across the raw checkpoint messages (same raw shape
// checkpoint.service.js's normalizeMessages consumes) — same type-detection
// pattern as that function, kept independent of it since this only needs
// the ids, not a full transcript rebuild.
export function extractTaskToolCallIds(rawMessages) {
  const ids = [];
  for (const msg of rawMessages || []) {
    const type = typeof msg?.getType === 'function' ? msg.getType() : msg?.type;
    if (type !== 'ai' || !Array.isArray(msg.tool_calls)) continue;
    for (const tc of msg.tool_calls) {
      if (tc?.name === 'task' && tc.id) ids.push(tc.id);
    }
  }
  return ids;
}

// Re-keys this run's freshly-folded subagentTraces (in the order their
// owning `task` tool calls started, i.e. object key insertion order) against
// the real `task` tool_call ids the checkpoint now has (also in call order)
// — only the LAST N of them belong to THIS run (N = number of entries just
// folded); earlier turns' task calls must not be touched. Falls back to the
// original provisional key for any entry it can't confidently match, so a
// mismatch never means losing data — worst case is the pre-existing
// key-mismatch bug for that one entry, not a crash or a dropped trace.
export function reconcileSubagentTraceKeys(subagentTraces, realTaskToolCallIds) {
  const provisionalKeys = Object.keys(subagentTraces);
  if (provisionalKeys.length === 0) return subagentTraces;

  const relevant = realTaskToolCallIds.slice(-provisionalKeys.length);
  const reconciled = {};
  provisionalKeys.forEach((provisionalKey, i) => {
    const realId = relevant[i];
    reconciled[realId || provisionalKey] = subagentTraces[provisionalKey];
  });
  return reconciled;
}
