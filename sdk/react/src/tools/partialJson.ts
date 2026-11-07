// Tolerant JSON parsing for tool-call arguments that are still streaming in
// (TOOL_CALL_CHUNK deltas arrive a few characters at a time), so a tool
// renderer can show `{"title":"Shortl` as `{ title: "Shortl" }` instead of
// nothing until the call's arguments are complete.

/** Positions (outside strings) where the text can be cut back to a valid prefix. */
function scan(text: string): {
  stack: string[];
  inString: boolean;
  escaped: boolean;
  cuts: number[];
} {
  const stack: string[] = [];
  const cuts: number[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      cuts.push(i);
    } else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === ",") cuts.push(i);
  }
  return { stack, inString, escaped, cuts };
}

/** Close whatever is open at the end of `text`; may still be invalid (e.g. a dangling key). */
function closeUp(text: string): string {
  const { stack, inString, escaped } = scan(text);
  let out = text;
  if (inString) {
    if (escaped) out = out.slice(0, -1); // drop a dangling backslash
    out += '"';
  }
  out = out.replace(/\s+$/, "");
  if (out.endsWith(",")) out = out.slice(0, -1);
  else if (out.endsWith(":")) out += "null";
  // A number cut mid-way ("1." / "1e" / "-") isn't valid JSON yet.
  out = out.replace(/(-|\d+\.|\d+[eE][+-]?)$/, (m) =>
    m === "-" ? "null" : m.replace(/[.eE+-]+$/, ""),
  );
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}

/**
 * Parse a JSON value that may be truncated. Returns the most complete value
 * recoverable from the prefix, or `undefined` if nothing usable is there yet.
 * Complete JSON is returned exactly as `JSON.parse` would.
 */
export function parsePartialJson(text: string | undefined | null): unknown {
  if (typeof text !== "string") return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to repair
  }

  let candidate = trimmed;
  // Each failed attempt cuts back to the previous structural boundary (the
  // last `,` / `{` / `[` outside a string) — dropping, e.g., a half-typed key
  // or literal — until a valid prefix remains.
  for (let attempt = 0; attempt < 64 && candidate; attempt++) {
    try {
      return JSON.parse(closeUp(candidate));
    } catch {
      const { cuts } = scan(candidate);
      const last = cuts[cuts.length - 1];
      if (last === undefined) return undefined;
      // Keep an opening bracket (so "{" → {}), drop a trailing comma.
      const keep = candidate[last] === "," ? last : last + 1;
      if (keep >= candidate.length) {
        // Cutting here changes nothing — step past this boundary instead.
        candidate = candidate.slice(0, last);
      } else {
        candidate = candidate.slice(0, keep);
      }
    }
  }
  return undefined;
}
