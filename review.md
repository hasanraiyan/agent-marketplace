# Review: `prompt.md` — Agent Architecture Toggle (DeepAgent vs ReAct Agent)

## Verdict: Good — solid plan, ship it, with one real gap to decide on before implementing

## What's strong

1. **The core technical claim is now independently verified, not just inferred.** The plan's crux — that `createAgent` (from `langchain`, the non-deprecated replacement for `@langchain/langgraph/prebuilt`'s `createReactAgent`) accepts `model`, `systemPrompt`, `checkpointer`, `store`, `tools`, and `middleware` in exactly the shapes needed to reuse `contextOverrideMiddleware` unchanged — was confirmed by reading `langchain@1.5.1`'s own `dist/agents/types.d.ts` directly (`systemPrompt?: string | SystemMessage` line 515, `checkpointer?: BaseCheckpointSaver | boolean` line 599, `store?: BaseStore` line 604, `middleware?: readonly AnyAgentMiddleware[]` line 665, `model: string | AgentLanguageModelLike` line 423, `tools?: (ServerTool | ClientTool)[]` line 445). This wasn't confirmed before the plan was written — it was only inferred from tracing that `createDeepAgent` wraps `createAgent`. It checks out.
2. **Correctly avoided the deprecated API.** Confirmed via web search that `@langchain/langgraph/prebuilt`'s `createReactAgent` is deprecated as of LangGraph v1, with `import { createAgent } from "langchain"` as the documented replacement. Going straight to `createAgent` (rather than the tempting, differently-named, more "obviously ReAct" `createReactAgent`) is the right call and avoids building on a deprecated foundation from day one.
3. **Caught a real, non-obvious bug the feature would otherwise ship with**: the workflow snapshot-pinning gap (section 3 of the plan). A published workflow with `pinSnapshot: true` on a react-mode Agent Step would silently keep rebuilding as deepagent forever, because the synthetic `agentDoc` built from `agentSnapshots[node.id]` has no `agentType` field. This is exactly the kind of gap that's easy to miss (it's in a different module — `workflow.factory.js`/`workflow.service.js`/`workflowVersion.model.js` — from where the main feature lives) and would have quietly defeated the entire point of the feature for any workflow using pinned snapshots. Calling this out as "must fix, not optional" is correct.
4. **Zero-migration backward compatibility is actually sound, not just asserted.** Defaulting the new field and relying on `updatedAt`-driven cache invalidation (already existing behavior, not new logic) means every pre-existing agent and every existing code path is provably unaffected — this was checked against the actual cache-key/invalidation logic in `agent.factory.js`, not assumed.
5. **Frontend plan reuses an established pattern** (`rest-tool-editor.tsx`'s Select-with-conditional-dependent-fields) rather than inventing new UI conventions, and correctly identifies that Memory/Subagents have no UI to hide in the first place (verified by search, not assumed).

## The one real gap

**Switching `agentType` on an agent that already has conversation history is not addressed at all.** deepagents' compiled graph declares extra state channels (`files`, `todos`) that a plain `createAgent`-built graph does not. If a user flips an *existing* agent with real prior threads from `deepagent` → `react`, the next message on any of those existing `thread_id`s will try to resume from a checkpoint whose stored state includes channels the new graph's state schema never declared. What actually happens in that case — silently dropped extra channels, a deserialization error, or something else entirely — was never tested or even researched. This is a real correctness question, not a cosmetic one, and it's the only place the plan is speculative rather than grounded.

This doesn't block writing the plan (it's fine as a plan), but before implementation ships, one of these should be decided and added to the plan:
- Test the actual behavior directly (create a deepagent-mode agent, have a real conversation, flip it to react-mode, send another message on the same thread — see what happens), or
- Sidestep the question by disallowing `agentType` changes once an agent has any existing threads (simplest, but more restrictive — may not match what the user actually wants, which seemed to be a freely-toggleable setting), or
- Explicitly document it as unsupported/undefined behavior for now and let it surface if it becomes a real user complaint.

## Minor, non-blocking notes

- The "trimmed PRESENT FILE note" system-prompt copy for react mode is hand-waved ("append only a trimmed note") — fine for a plan, but actual wording needs to be written during implementation, not deferred further.
- No automated/unit tests are proposed anywhere in the verification plan — consistent with this codebase's existing manual-verification norm throughout this whole session, so not a real ding, just noting it's manual-only.
