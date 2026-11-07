import { serializeForTrace } from './traceSerializer.js';

/**
 * Human-in-the-loop for traces. A paused run (HITL tool approval, a
 * clarification question, or frontend tools waiting on the browser) and the
 * later run that resumes it are two separate traces; these helpers turn the
 * translator's `describeInterrupt()` info and the `Command({ resume })` value
 * into small, readable records so both traces explain what happened.
 */

const KIND_TITLE = {
  hitl: 'Approval required',
  clarification: 'Clarification requested',
  frontend_tool: 'Waiting for client tools',
};

function str(v, max = 400) {
  if (typeof v !== 'string') return '';
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/**
 * @param {object|null|undefined} info  `describeInterrupt()` result
 * @returns {null | { kind, title, summary, actions?, questions? }}
 */
export function summarizeInterrupt(info) {
  if (!info || !info.kind) return null;

  if (info.kind === 'hitl') {
    const configs = new Map(
      (info.reviewConfigs || []).map((c) => [c?.actionName, c?.allowedDecisions || null])
    );
    const actions = (info.actionRequests || []).map((a) => ({
      name: a?.name || 'tool',
      args: serializeForTrace(a?.args ?? a?.arguments ?? {}, 4000),
      description: str(a?.description),
      allowedDecisions: configs.get(a?.name) || null,
    }));
    return {
      kind: 'hitl',
      title: KIND_TITLE.hitl,
      summary: `Approve ${actions.map((a) => a.name).join(', ') || 'tool call'}?`,
      actions,
    };
  }

  if (info.kind === 'frontend_tool') {
    const actions = (info.calls || []).map((c) => ({
      name: c?.name || 'tool',
      args: serializeForTrace(c?.args ?? {}, 4000),
      toolCallId: c?.toolCallId || null,
    }));
    return {
      kind: 'frontend_tool',
      title: KIND_TITLE.frontend_tool,
      summary: `Client runs ${actions.map((a) => a.name).join(', ') || 'tools'}`,
      actions,
    };
  }

  const questions = (info.questions || []).map((q) => ({
    id: q?.id,
    text: str(q?.text, 1000),
    options: Array.isArray(q?.options) ? q.options.slice(0, 20) : [],
  }));
  return {
    kind: 'clarification',
    title: KIND_TITLE.clarification,
    summary: questions[0]?.text || 'Agent asked the user a question',
    questions,
  };
}

const DECISION_VERB = {
  approve: 'Approved',
  reject: 'Rejected',
  edit: 'Edited',
  respond: 'Responded to',
};

/**
 * @param {object} pending       `describeInterrupt()` result of the paused run
 * @param {*}      resumeValue   the value passed to `Command({ resume })`
 * @returns {{ kind, summary, decisions?, answers?, results? }}
 */
export function summarizeResume(pending, resumeValue) {
  const kind = pending?.kind || 'clarification';

  if (kind === 'hitl') {
    const names = (pending.actionRequests || []).map((a) => a?.name || 'tool');
    const decisions = (resumeValue?.decisions || []).map((d, i) => ({
      action: names[i] || names[0] || 'tool',
      type: d?.type || 'unknown',
      message: str(d?.message, 2000) || null,
      editedArgs: d?.editedAction?.args ? serializeForTrace(d.editedAction.args, 4000) : null,
    }));
    const summary =
      decisions
        .map(
          (d) =>
            `${DECISION_VERB[d.type] || d.type} ${d.action}${d.message ? `: ${d.message}` : ''}`
        )
        .join(' · ') || 'Resumed after approval';
    return { kind, summary: str(summary, 1000), decisions };
  }

  if (kind === 'frontend_tool') {
    const calls = pending.calls || [];
    const byInterrupt = resumeValue && typeof resumeValue === 'object' ? resumeValue : {};
    const results = calls.map((c) => {
      const answer =
        (c.interruptId && byInterrupt[c.interruptId]) || (calls.length === 1 ? resumeValue : null);
      return {
        name: c.name,
        toolCallId: c.toolCallId || null,
        result: answer?.result !== undefined ? serializeForTrace(answer.result, 4000) : null,
        error: answer?.error ? str(String(answer.error), 1000) : null,
      };
    });
    const summary = results.map((r) => `${r.name} ${r.error ? 'failed' : 'returned'}`).join(' · ');
    return { kind, summary: summary || 'Client tool results', results };
  }

  // clarification: plain text, or { answers, text }
  if (resumeValue && typeof resumeValue === 'object') {
    const answers = serializeForTrace(resumeValue.answers ?? null, 4000);
    const text = str(resumeValue.text, 2000);
    return { kind, summary: text || 'Answered the agent’s questions', answers, text: text || null };
  }
  return {
    kind,
    summary: str(String(resumeValue ?? ''), 2000) || 'Answered',
    text: str(String(resumeValue ?? ''), 2000),
  };
}

export default { summarizeInterrupt, summarizeResume };
