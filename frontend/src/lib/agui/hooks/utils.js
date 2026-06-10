export function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : part?.text || ""))
    .join("");
}

// Parse the todo list out of a completed `write_todos` tool call so the plan
// can update mid-run (the authoritative STATE_SNAPSHOT only arrives at end of
// turn). Returns null unless the args contain a well-formed todos array.
export function todosFromToolArgs(name, argsText) {
  if (!name || !name.toLowerCase().includes("todo")) return null;
  const parsed = parseJsonMaybe(argsText);
  if (!Array.isArray(parsed?.todos)) return null;
  return parsed.todos
    .map((todo) => ({
      content: typeof todo?.content === "string" ? todo.content : "",
      status: typeof todo?.status === "string" ? todo.status : "pending",
    }))
    .filter((todo) => todo.content);
}

export function replaceById(items, item) {
  const index = items.findIndex((x) => x.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((x, i) => (i === index ? item : x));
}

export function ensureConversationEntry(entries, type, refId) {
  if (entries.some((entry) => entry.type === type && entry.refId === refId)) {
    return entries;
  }
  return [...entries, { id: id(`entry-${type}`), type, refId }];
}

export function normalizeClarificationQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((question, index) => {
      const text =
        typeof question?.text === "string" ? question.text.trim() : "";
      if (!text) return null;
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) =>
              typeof option === "string" ? option.trim() : "",
            )
            .filter(Boolean)
        : [];
      return {
        id:
          typeof question.id === "string" && question.id.trim()
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

export function buildClarificationTranscript(answers) {
  return answers
    .map((answer) => {
      const value = answer.skipped ? "Skipped" : answer.answer || "";
      return `Q: ${answer.question}\nA: ${value}`;
    })
    .join("\n\n");
}
