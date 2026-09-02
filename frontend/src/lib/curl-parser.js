/**
 * Minimal hand-written cURL parser for the REST API Tool Builder's
 * "Paste it to auto-fill the form" affordance (PERSONA_REST_TOOL_REQUEST.md).
 *
 * Deliberately not a full shell parser or a heavy library (curlconverter,
 * etc.) — the spec only needs "common flags", and every other narrow-grammar
 * parser in this codebase (agent-backend's manual `<keyId>.<secret>` bearer
 * split, its templateEngine.js token regex) is hand-rolled for the same
 * reason: this is a well-bounded, best-effort convenience, not a general
 * shell interpreter.
 *
 * Supported: -X/--request, repeated -H/--header, repeated
 * -d/--data/--data-raw/--data-binary, and the bare URL. -u/--user (Basic
 * auth) is detected and surfaced as a warning rather than imported, since
 * the builder's Auth tab only supports a Bearer secret.
 */

/** Tokenizes a command string respecting single/double-quoted arguments. */
function tokenize(input) {
  const tokens = [];
  let current = "";
  let quote = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && i + 1 < input.length) {
        current += input[++i];
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === "\\" && input[i + 1] === "\n") {
      i++; // line-continuation: collapse to nothing (not even a space)
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function splitHeader(value) {
  const idx = value.indexOf(":");
  if (idx === -1) return { key: value.trim(), value: "" };
  return { key: value.slice(0, idx).trim(), value: value.slice(idx + 1).trim() };
}

/**
 * @param {string} curlString
 * @returns {{
 *   method: string,
 *   url: string,
 *   queryParams: Array<{key: string, value: string}>,
 *   headers: Array<{key: string, value: string}>,
 *   body: string | null,
 *   warnings: string[],
 * }}
 */
export function parseCurl(curlString) {
  const warnings = [];
  const tokens = tokenize((curlString || "").trim()).filter((t) => t !== "curl");

  let method = null;
  let url = null;
  const headers = [];
  const bodyParts = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "-X" || token === "--request") {
      method = tokens[++i]?.toUpperCase();
    } else if (token === "-H" || token === "--header") {
      const raw = tokens[++i];
      if (raw) headers.push(splitHeader(raw));
    } else if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary") {
      const raw = tokens[++i];
      if (raw !== undefined) bodyParts.push(raw);
    } else if (token === "--data-urlencode") {
      i++; // skip its value
      warnings.push("--data-urlencode was not imported — encode the value manually if needed.");
    } else if (token === "-u" || token === "--user") {
      i++; // skip its value
      warnings.push(
        "Basic auth (-u) was detected but not imported — this builder's Auth tab only supports a Bearer secret."
      );
    } else if (token.startsWith("-")) {
      // Unrecognized flag — best-effort skip. If it looks like it takes a
      // value (next token doesn't start with '-' and isn't the URL-shaped
      // final token), skip that too, so it isn't misread as the URL.
      const next = tokens[i + 1];
      if (next && !next.startsWith("-") && !/^https?:\/\//i.test(next) && i + 2 < tokens.length) {
        i++;
      }
    } else if (!url) {
      url = token;
    }
  }

  if (!url) {
    return { method: "GET", url: "", queryParams: [], headers: [], body: null, warnings: ["No URL found in the pasted command."] };
  }

  // Split the query string off manually rather than via `new URL()` — a
  // URL containing an unresolved {{token}} in its path (very common here)
  // gets its braces percent-encoded by the URL parser, corrupting the
  // template placeholder. Only the already-isolated query string, which
  // rarely carries {{tokens}} of its own, goes through URLSearchParams.
  let queryParams = [];
  let baseUrl = url;
  const queryIndex = url.indexOf("?");
  if (queryIndex !== -1) {
    baseUrl = url.slice(0, queryIndex);
    const search = url.slice(queryIndex + 1);
    queryParams = Array.from(new URLSearchParams(search).entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }

  const body = bodyParts.length > 0 ? bodyParts.join("&") : null;
  const resolvedMethod = method || (body ? "POST" : "GET");

  return { method: resolvedMethod, url: baseUrl, queryParams, headers, body, warnings };
}
