import {
  FileCode,
  FileJson,
  Code,
  FileText,
  Hash,
  Globe,
  Terminal,
} from "lucide-react";

export function tryParseJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Tool arguments can arrive double-encoded — LangChain's tool tracer wraps
// stringified args as { input: "<json>" }. Unwrap that envelope so callers
// see the real args (file_path, old_string, todos, ...). Safe on clean args.
export function parseToolArgs(argsText) {
  const parsed = tryParseJson(argsText);
  if (
    parsed &&
    typeof parsed.input === "string" &&
    Object.keys(parsed).length === 1
  ) {
    return tryParseJson(parsed.input) ?? parsed;
  }
  return parsed;
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function prettyToolName(name) {
  return (name || "tool")
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function isReadFileTool(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower === "read_file" ||
    lower === "view_file" ||
    lower === "read_file_content" ||
    lower.includes("read_file") ||
    lower.includes("view_file")
  );
}

export function getReadFileToolDetails(tool) {
  const args = parseToolArgs(tool.argumentsText) || {};

  // Detect file path key
  const pathKeys = [
    "file_path",
    "filePath",
    "path",
    "filename",
    "fileName",
    "targetFile",
    "TargetFile",
    "target_file",
  ];
  let filePath = "";
  for (const k of pathKeys) {
    if (typeof args[k] === "string") {
      filePath = args[k];
      break;
    }
  }

  if (!filePath) return null;

  const content = tool.resultText || "";

  // Gather other metadata arguments (like offset, limit, etc.)
  const otherArgs = {};
  for (const [key, val] of Object.entries(args)) {
    const isPathKey = pathKeys.some(
      (pk) => pk.toLowerCase() === key.toLowerCase(),
    );
    if (!isPathKey) {
      otherArgs[key] = val;
    }
  }

  return { filePath, content, otherArgs };
}

export function isLsTool(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower === "ls" ||
    lower === "list_dir" ||
    lower === "list_directory" ||
    lower.includes("list_dir") ||
    lower.includes("list_directory")
  );
}

export function parseLsResults(resultText) {
  if (!resultText) return [];

  // Try to parse as JSON first
  const parsed = tryParseJson(resultText);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (typeof item === "string") {
        const isDir = item.endsWith("/") || item.includes("(directory)");
        return {
          name: item.replace(/\(directory\)/g, "").trim(),
          isDir,
        };
      }
      return {
        name: item.name || item.path || "",
        isDir: !!(item.isDir || item.is_dir || item.isDirectory),
      };
    });
  }

  // Parse as plain text lines
  return resultText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isDir =
        line.endsWith("/") ||
        line.toLowerCase().includes("(directory)") ||
        line.toLowerCase().includes("(dir)");
      let name = line
        .replace(/\(directory\)/gi, "")
        .replace(/\(dir\)/gi, "")
        .trim();
      return { name, isDir };
    });
}

export function getFileSystemActionDetails(action) {
  if (!action.args || typeof action.args !== "object") return null;

  const args = action.args;

  // Detect file path key
  const pathKeys = [
    "file_path",
    "filePath",
    "path",
    "filename",
    "fileName",
    "targetFile",
    "TargetFile",
    "target_file",
  ];
  let filePath = "";
  for (const k of pathKeys) {
    if (typeof args[k] === "string") {
      filePath = args[k];
      break;
    }
  }

  // Detect file content key
  const contentKeys = [
    "content",
    "codeContent",
    "replacementContent",
    "ReplacementContent",
    "text",
    "content_to_write",
    "ReplacementChunks",
  ];
  let content = "";
  let hasContent = false;

  for (const k of contentKeys) {
    if (args[k] !== undefined && args[k] !== null) {
      if (typeof args[k] === "string") {
        content = args[k];
        hasContent = true;
        break;
      } else if (Array.isArray(args[k]) || typeof args[k] === "object") {
        content = JSON.stringify(args[k], null, 2);
        hasContent = true;
        break;
      }
    }
  }

  if (!filePath) return null;

  // Gather other metadata arguments
  const otherArgs = {};
  for (const [key, val] of Object.entries(args)) {
    const isPathKey = pathKeys.some(
      (pk) => pk.toLowerCase() === key.toLowerCase(),
    );
    const isContentKey = contentKeys.some(
      (ck) => ck.toLowerCase() === key.toLowerCase(),
    );
    if (!isPathKey && !isContentKey) {
      otherArgs[key] = val;
    }
  }

  return { filePath, content, hasContent, otherArgs };
}

export function isFileWriteTool(name) {
  return (name || "").toLowerCase() === "write_file";
}

export function isFileEditTool(name) {
  return (name || "").toLowerCase() === "edit_file";
}

export function isTodoTool(name) {
  return (name || "").toLowerCase().includes("todo");
}

export function isSkillTool(name) {
  return (name || "").toLowerCase() === "manage_skill";
}

export function isAgentTool(name) {
  const n = (name || "").toLowerCase();
  return n === "upsert_agent" || n === "manage_agent";
}

export function parseTodos(argsText, resultText) {
  if (resultText) {
    const parsed = tryParseJson(resultText);
    const rTodos = parsed?.update?.todos || parsed?.todos;
    if (Array.isArray(rTodos)) {
      const todos = rTodos
        .map((todo) => ({
          content: typeof todo?.content === "string" ? todo.content : "",
          status: typeof todo?.status === "string" ? todo.status : "pending",
        }))
        .filter((todo) => todo.content);
      if (todos.length) return todos;
    }
  }

  const parsed = parseToolArgs(argsText);
  if (!Array.isArray(parsed?.todos)) return null;
  const todos = parsed.todos
    .map((todo) => ({
      content: typeof todo?.content === "string" ? todo.content : "",
      status: typeof todo?.status === "string" ? todo.status : "pending",
    }))
    .filter((todo) => todo.content);
  return todos.length ? todos : null;
}

export function getSuggestedPrompts(agent) {
  const name = (agent?.name || "Agent").toLowerCase();
  const category = (agent?.category || "").toLowerCase();

  if (name.includes("architect") || name.includes("sage")) {
    return [
      {
        title: "Build a new coding assistant agent",
        prompt:
          "Help me design a new Python Coding Assistant agent. I want it to focus on writing clean code and using web search.",
      },
      {
        title: "Optimize an existing agent's prompt",
        prompt:
          "I want to improve the system prompt of my writing assistant agent. Can you help me make it sound more professional?",
      },
      {
        title: "Explain how skills and providers work",
        prompt:
          "What is the difference between an Agent's Skills and its Model Provider? How do I configure Tavily search?",
      },
    ];
  }

  if (
    category.includes("code") ||
    category.includes("dev") ||
    category.includes("software") ||
    name.includes("code") ||
    name.includes("dev")
  ) {
    return [
      {
        title: "Find a bug in my code",
        prompt:
          "I have a bug in my React component where state updates are lagging. Can you help me debug it?",
      },
      {
        title: "Write a utility function",
        prompt:
          "Write a high-performance helper function in TypeScript to parse and format nested JSON structures.",
      },
      {
        title: "Explain a software concept",
        prompt:
          "Can you explain the difference between client-side rendering (CSR) and server-side rendering (SSR) in Next.js?",
      },
    ];
  }

  return [
    {
      title: "Explore capabilities",
      prompt: `What are your core capabilities as a ${agent?.name || "Agent"} agent, and how can you help me today?`,
    },
    {
      title: "Start a planning session",
      prompt:
        "Help me brainstorm and write a structured project outline for my next task.",
    },
    {
      title: "Analyze some text or data",
      prompt:
        "I'd like to share some text/code with you to get your feedback and suggestions for improvement.",
    },
  ];
}

export function getFileIcon(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return <FileCode className="size-4 text-amber-400" />;
    case "json":
      return <FileJson className="size-4 text-amber-500" />;
    case "py":
      return <Code className="size-4 text-blue-500" />;
    case "md":
      return <FileText className="size-4 text-slate-400" />;
    case "css":
    case "scss":
      return <Hash className="size-4 text-pink-500" />;
    case "html":
      return <Globe className="size-4 text-orange-500" />;
    case "sh":
    case "bash":
    case "zsh":
      return <Terminal className="size-4 text-emerald-500" />;
    case "c":
    case "cpp":
    case "h":
      return <FileCode className="size-4 text-slate-600" />;
    default:
      return <FileText className="size-4 text-slate-400" />;
  }
}

export function getLanguage(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "markup";
    case "sh":
    case "bash":
      return "bash";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "markup";
  }
}

export function queryFromArgs(argsText) {
  const parsed = parseToolArgs(argsText);
  const value =
    parsed?.query ||
    parsed?.q ||
    parsed?.search_query ||
    parsed?.text ||
    parsed?.input;
  if (value) return String(value);
  return argsText?.trim().startsWith("{") ? "" : argsText?.trim() || "";
}

export function toolTitle(tool) {
  const name = tool.name?.toLowerCase() || "tool";
  const query = queryFromArgs(tool.argumentsText);

  if (
    name === "search_web" ||
    name.includes("google") ||
    name.startsWith("tavily")
  ) {
    if (query) {
      return tool.status === "completed"
        ? `Searched the web for "${query}"`
        : `Searching the web for "${query}"`;
    }
    return tool.status === "completed"
      ? "Searched the web"
      : "Searching the web";
  }

  if (
    name === "search_knowledge_base" ||
    name === "list_knowledge_base_sources"
  ) {
    const isSearchAction = name === "search_knowledge_base";
    const args = parseToolArgs(tool.argumentsText);
    const kbName = args?.knowledgeBaseName || "Knowledge Base";
    const kbQuery = args?.query || query;

    if (isSearchAction) {
      if (kbQuery) {
        return tool.status === "completed"
          ? `Searched knowledge base "${kbName}" for "${kbQuery}"`
          : `Searching knowledge base "${kbName}" for "${kbQuery}"`;
      }
      return tool.status === "completed"
        ? `Searched knowledge base "${kbName}"`
        : `Searching knowledge base "${kbName}"`;
    } else {
      return tool.status === "completed"
        ? `Listed documents in "${kbName}"`
        : `Listing documents in "${kbName}"`;
    }
  }

  if (name.startsWith("search_") || name.startsWith("list_sources_")) {
    const isSearchAction = name.startsWith("search_");
    const rawKbName = name.replace(/^(search_|list_sources_)/, "");
    const kbName = rawKbName
      .split(/[_\-\s]/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    if (isSearchAction) {
      if (query) {
        return tool.status === "completed"
          ? `Searched knowledge base "${kbName}" for "${query}"`
          : `Searching knowledge base "${kbName}" for "${query}"`;
      }
      return tool.status === "completed"
        ? `Searched knowledge base "${kbName}"`
        : `Searching knowledge base "${kbName}"`;
    } else {
      return tool.status === "completed"
        ? `Listed documents in "${kbName}"`
        : `Listing documents in "${kbName}"`;
    }
  }

  if (name.includes("todo")) {
    return tool.status === "completed"
      ? "Updated the plan"
      : "Updating the plan";
  }
  if (
    name === "read_file" ||
    name === "view_file" ||
    name.includes("read_file") ||
    name.includes("view_file")
  ) {
    return tool.status === "completed" ? "Read file" : "Reading file";
  }
  if (
    name === "ls" ||
    name === "list_dir" ||
    name === "list_directory" ||
    name.includes("list_dir") ||
    name.includes("list_directory")
  ) {
    return tool.status === "completed"
      ? "Listed directory"
      : "Listing directory";
  }
  if (name.includes("file") || name === "glob") {
    return tool.status === "completed" ? "Updated files" : "Working with files";
  }
  if (name === "manage_skill") {
    const args = parseToolArgs(tool.argumentsText);
    const action = args?.action === "delete" ? "Deleting" : "Managing";
    const skillName = args?.name || "skill";
    return tool.status === "completed"
      ? `${args?.action === "delete" ? "Deleted" : "Saved"} skill "${skillName}"`
      : `${action} skill "${skillName}"`;
  }
  if (name === "upsert_agent" || name === "manage_agent") {
    const args = parseToolArgs(tool.argumentsText);
    const agentName = args?.name || "agent";
    return tool.status === "completed"
      ? `Saved agent "${agentName}"`
      : `Saving agent "${agentName}"`;
  }
  if (name === "task") {
    const args = parseToolArgs(tool.argumentsText);
    const label = args?.subagent_type
      ? `${args.subagent_type} subagent`
      : "subagent";
    return tool.status === "completed" ? `Ran ${label}` : `Running ${label}`;
  }

  return name
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function searchResults(tool) {
  const parsed = tryParseJson(tool.resultText);
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed)) return parsed;
  return [];
}
