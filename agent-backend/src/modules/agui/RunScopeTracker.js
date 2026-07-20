import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

/**
 * Records the run ancestry (runId -> parentRunId) of every model, chain, and
 * tool invocation in a request.
 *
 * Why: `streamEvents` (v2) in JS does not expose an event's parent run ids, so
 * the AG-UI translator cannot tell WHICH `task` (subagent) call a nested event
 * belongs to. A "most recently started task" stack works only while subagents
 * run one at a time — deepagents executes parallel task calls via Promise.all,
 * interleaving their events. This handler runs alongside the event stream and
 * lets the translator walk an event's ancestry up to its enclosing task run.
 *
 * One instance per request; the map is GC'd with it.
 */
export class RunScopeTracker extends BaseCallbackHandler {
  name = 'persona-run-scope-tracker';
  parentOf = new Map(); // runId -> parentRunId

  record(runId, parentRunId) {
    if (runId && parentRunId && !this.parentOf.has(runId)) {
      this.parentOf.set(runId, parentRunId);
    }
  }

  /**
   * Walks up the ancestry from `runId` (exclusive) and returns the first
   * ancestor run id for which `predicate` returns true, or null. Depth-capped
   * so a corrupt map can never loop forever.
   */
  findAncestor(runId, predicate, maxDepth = 64) {
    let current = this.parentOf.get(runId);
    let depth = 0;
    while (current && depth < maxDepth) {
      if (predicate(current)) return current;
      current = this.parentOf.get(current);
      depth += 1;
    }
    return null;
  }

  handleLLMStart(_llm, _prompts, runId, parentRunId) {
    this.record(runId, parentRunId);
  }

  handleChatModelStart(_llm, _messages, runId, parentRunId) {
    this.record(runId, parentRunId);
  }

  handleChainStart(_chain, _inputs, runId, parentRunId) {
    this.record(runId, parentRunId);
  }

  handleToolStart(_tool, _input, runId, parentRunId) {
    this.record(runId, parentRunId);
  }
}
