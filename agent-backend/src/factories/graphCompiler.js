import { createDeepAgent, StateBackend } from 'deepagents';

/**
 * Compiles the LangGraph StateGraph instance for the agent.
 * @param {Object} params - The compilation parameters.
 * @returns {Promise<Object>} The compiled agent instance and the store.
 */
export async function compileGraph({
  llm,
  systemPrompt,
  checkpointer,
  tools,
  interruptOn,
  hasSkills,
}) {
  const { InMemoryStore } = await import('@langchain/langgraph');
  const store = new InMemoryStore();

  // 1. Wrap checkpointer with a Proxy for safety
  let checkpointerWarned = false;
  const safeCheckpointer = checkpointer
    ? new Proxy(checkpointer, {
        get(target, prop, receiver) {
          if (prop === 'putWrites') {
            return async (...args) => {
              try {
                // Robust empty-batch detection: scan args for any array-like candidate
                const foundArray = args.find(
                  (a) => Array.isArray(a) || (a && typeof a.length === 'number')
                );
                if (foundArray && foundArray.length === 0) return;

                // If first arg is falsy or no args, treat as no-op
                if (args.length === 0 || !args[0]) return;

                if (typeof target.putWrites === 'function') {
                  return await target.putWrites.apply(target, args);
                }
              } catch (err) {
                // Only warn once to reduce log noise
                if (!checkpointerWarned) {
                  console.warn(
                    '[GraphCompiler] checkpointer.putWrites error:',
                    err?.message || err
                  );
                  checkpointerWarned = true;
                }
              }
            };
          }

          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') return value.bind(target);
          return value;
        },
      })
    : checkpointer;

  // 2. Build interruptOn from the agent's stored config.
  const interruptOnConfig =
    interruptOn instanceof Map ? Object.fromEntries(interruptOn) : interruptOn || {};

  // 3. Assemble Custom DeepAgent Runtime
  const agentInstance = await createDeepAgent({
    model: llm,
    systemPrompt: systemPrompt,
    checkpointer: safeCheckpointer,
    store: store,
    tools: tools,
    interruptOn: interruptOnConfig,
    backend: new StateBackend(),
    ...(hasSkills ? { skills: ['/skills/'] } : {}),
  });

  return {
    agentInstance,
    store,
  };
}
