import { EventType } from '@ag-ui/core';

// Recursively find LangGraph interrupt payloads from a GraphInterrupt or an
// AggregateError (which wraps GraphInterrupt on err.errors[N].interrupts).
export function extractGraphInterrupts(err) {
  if (!err) return null;
  if (Array.isArray(err.interrupts) && err.interrupts.length > 0) return err.interrupts;
  if (Array.isArray(err.errors)) {
    for (const inner of err.errors) {
      const found = extractGraphInterrupts(inner);
      if (found) return found;
    }
  }
  if (err.cause) return extractGraphInterrupts(err.cause);
  return null;
}

export function extractStreamInterrupts(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value.__interrupt__) && value.__interrupt__.length > 0) {
    return value.__interrupt__;
  }

  if (Array.isArray(value.interrupts) && value.interrupts.length > 0) {
    return value.interrupts;
  }

  for (const child of Object.values(value)) {
    const found = extractStreamInterrupts(child, seen);
    if (found) return found;
  }

  return null;
}

// Determine whether a thrown error is actually a human-in-the-loop interrupt
// rather than a genuine failure.
export function isInterruptError(err, graphInterrupts) {
  return (
    (graphInterrupts ?? extractGraphInterrupts(err)) != null ||
    err?.name === 'GraphInterrupt' ||
    Boolean(err?.message?.toLowerCase().includes('interrupt'))
  );
}

export function normalizeClarificationQuestions(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const rawQuestions = Array.isArray(interruptValue?.questions) ? interruptValue.questions : [];

  return rawQuestions
    .map((question, index) => {
      const text = typeof question?.text === 'string' ? question.text.trim() : '';
      if (!text) return null;
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => (typeof option === 'string' ? option.trim() : ''))
            .filter(Boolean)
        : [];

      return {
        id:
          typeof question.id === 'string' && question.id.trim()
            ? question.id.trim()
            : `question_${index + 1}`,
        text,
        options,
        required: question.required !== false,
        allowCustom: question.allowCustom !== false,
      };
    })
    .filter(Boolean);
}

// Classify the first interrupt payload of a paused run. HITL interrupts come from
// langchain's humanInTheLoopMiddleware (interruptOn) and carry actionRequests +
// reviewConfigs; they must be resumed with `{ decisions: [...] }`. Other interrupt
// payloads resume with raw user text.
export function describeInterrupt(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const actionRequests = interruptValue?.actionRequests;

  if (Array.isArray(actionRequests) && actionRequests.length > 0) {
    return {
      kind: 'hitl',
      actionCount: actionRequests.length,
      actionRequests,
      reviewConfigs: Array.isArray(interruptValue?.reviewConfigs)
        ? interruptValue.reviewConfigs
        : [],
    };
  }
  return {
    kind: 'clarification',
    actionCount: 0,
    questions: normalizeClarificationQuestions(graphInterrupts, err),
  };
}

// Build the value passed to Command({ resume }) when a paused thread receives the
// next client request. HITL interrupts (interruptOn tool approval) must resume with
// `{ decisions: [...] }`: structured decisions from the client are forwarded as-is,
// and a plain text reply is translated into reject-with-feedback so the model
// re-plans with the user's message. Clarification interrupts resume with raw text.
export function buildResumeValue(pendingInterrupt, resume, content) {
  if (pendingInterrupt?.kind !== 'hitl') {
    if (Array.isArray(resume?.answers) && resume.answers.length > 0) {
      return {
        answers: resume.answers,
        text: typeof resume.text === 'string' ? resume.text : content,
      };
    }
    return content;
  }

  if (Array.isArray(resume?.decisions) && resume.decisions.length > 0) {
    return { decisions: resume.decisions };
  }

  const actionCount = pendingInterrupt.actionCount || 1;
  return {
    decisions: Array.from({ length: actionCount }, () => ({
      type: 'reject',
      message: content || 'User declined the action.',
    })),
  };
}

// Build the user-facing prompt shown when the graph pauses at an interrupt. If the
// interrupt carried structured questions/options, render them as a numbered list.
export function buildInterruptNotice(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const actionRequests = interruptValue?.actionRequests;
  if (Array.isArray(actionRequests) && actionRequests.length > 0) {
    const lines = actionRequests.map((action, i) => `**${i + 1}. ${action?.name || 'tool'}**`);
    return (
      `I'd like to run the following ${actionRequests.length > 1 ? 'actions' : 'action'} and need your approval:\n\n` +
      `${lines.join('\n')}\n\n` +
      `Approve to continue, or reply with feedback and I'll adjust.`
    );
  }

  const questions = interruptValue?.questions;

  if (Array.isArray(questions) && questions.length > 0) {
    const lines = questions.map((q, i) => {
      const opts = (q.options || [])
        .map((o, j) => `  ${String.fromCharCode(97 + j)}) ${o}`)
        .join('\n');
      return `**${i + 1}. ${q.text}**${opts ? '\n' + opts : ''}`;
    });
    return (
      `I need a bit more information before I continue:\n\n${lines.join('\n\n')}\n\n` +
      `Reply with your answer and I'll pick up right where I left off.`
    );
  }
  return 'I need your input to continue. Please reply with your answer.';
}

export function buildClarificationCustomEvent(interruptInfo) {
  if (interruptInfo.kind !== 'clarification' || interruptInfo.questions.length === 0) return null;
  return {
    type: EventType.CUSTOM,
    name: 'clarification_request',
    value: {
      questions: interruptInfo.questions,
      currentIndex: 0,
    },
  };
}
