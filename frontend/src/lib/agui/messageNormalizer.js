/**
 * Normalise LangChain / LangGraph message objects into the shape
 * useAguiChat / AguiAgentChat expects: { id, role, content }
 *
 * LangGraph MongoDBSaver stores messages as serialised LangChain objects:
 *   {
 *     lc: 1,
 *     type: "constructor",           ← always "constructor", NOT the role!
 *     id:   ["langchain_core", "messages", "human", "HumanMessage"],
 *     kwargs: { content: "...", ... }
 *   }
 *
 * The role lives in the LAST element of the `id` array.
 * We also accept the simpler { type: "human"|"ai", content } shape as a fallback.
 */
export function normaliseLangChainMessages(raw) {
  if (!Array.isArray(raw)) {
    return { messages: [], toolCalls: [], conversation: [] };
  }

  const messages = [];
  const toolCalls = [];
  const conversation = [];

  raw.forEach((msg, i) => {
    if (!msg) return;

    // ── Unwrap LangChain constructor serialisation ──────────────────────────
    const isLcConstructor =
      msg.lc === 1 && msg.type === "constructor" && Array.isArray(msg.id);

    const className = isLcConstructor
      ? (msg.id[msg.id.length - 1] || "").toLowerCase()
      : "";

    const m = isLcConstructor
      ? { ...(msg.kwargs || {}), _lcClassName: className }
      : msg;

    // ── Extract content ─────────────────────────────────────────────────────
    const content =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .map((p) => (typeof p === "string" ? p : p?.text || ""))
              .join("")
          : "";

    // ── Determine role ──────────────────────────────────────────────────────
    const lc = m._lcClassName || "";
    const typeField = (m.type || m._type || "").toLowerCase();

    let role = "assistant";
    const roleHint = lc || typeField;
    if (roleHint.includes("human") || roleHint.includes("user")) {
      role = "user";
    } else if (roleHint.includes("ai") || roleHint.includes("assistant")) {
      role = "assistant";
    } else if (roleHint.includes("system")) {
      role = "system";
    } else if (roleHint.includes("tool")) {
      role = "tool";
    }

    const id = m.id || `history-${i}`;

    if (role === "system") {
      return;
    }

    if (role === "user") {
      const msgObj = { id, role: "user", content };
      messages.push(msgObj);
      conversation.push({ id: `entry-${id}`, type: "message", refId: id });
    } else if (role === "assistant") {
      if (content) {
        const msgObj = { id, role: "assistant", content };
        messages.push(msgObj);
        conversation.push({ id: `entry-${id}`, type: "message", refId: id });
      }

      const toolCallsArray = m.tool_calls || m.toolCalls || [];
      if (Array.isArray(toolCallsArray)) {
        toolCallsArray.forEach((tc) => {
          if (!tc) return;
          const tcId = tc.id || `tool-${Math.random().toString(16).slice(2)}`;
          const tcName = tc.name || "tool";
          const tcArgs = tc.args
            ? typeof tc.args === "string"
              ? tc.args
              : JSON.stringify(tc.args)
            : "{}";

          const toolObj = {
            id: tcId,
            name: tcName,
            argumentsText: tcArgs,
            resultText: "",
            status: "completed",
          };
          toolCalls.push(toolObj);
          conversation.push({ id: `entry-${tcId}`, type: "tool", refId: tcId });
        });
      }
    } else if (role === "tool") {
      const toolCallId = m.tool_call_id;
      const resultText = content;
      const existingTool = toolCalls.find((t) => t.id === toolCallId);
      if (existingTool) {
        existingTool.resultText = resultText;
      } else if (toolCallId) {
        const toolObj = {
          id: toolCallId,
          name: m.name || "tool",
          argumentsText: "",
          resultText,
          status: "completed",
        };
        toolCalls.push(toolObj);
        conversation.push({ id: `entry-${toolCallId}`, type: "tool", refId: toolCallId });
      }
    }
  });

  return { messages, toolCalls, conversation };
}
