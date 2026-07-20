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
