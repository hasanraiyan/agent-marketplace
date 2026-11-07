/**
 * Turns arbitrary LangChain run inputs/outputs (messages, graph state,
 * tool payloads) into small, JSON-safe, secret-masked values for storage
 * on a TraceSpan.
 *
 * - LangChain messages collapse to `{ role, content, tool_calls?, name? }`.
 * - Keys that look like credentials are replaced with `***`.
 * - base64 data URLs (image attachments) are replaced with a size note.
 * - Long strings are cut, deep/wide structures are pruned, cycles are cut.
 * - If the result is still over `maxChars` once stringified, a truncated
 *   JSON preview string is stored instead.
 */

const SECRET_KEY_RE =
  /(api[_-]?key|apikey|authorization|password|passwd|secret|access[_-]?token|refresh[_-]?token|id[_-]?token|bearer|cookie|private[_-]?key|client[_-]?secret)/i;

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 60;
const MAX_STRING_CHARS = 8000;

function isMessage(value) {
  return (
    value &&
    typeof value === 'object' &&
    (typeof value._getType === 'function' || typeof value.getType === 'function') &&
    'content' in value
  );
}

function messageRole(msg) {
  try {
    const type = typeof msg.getType === 'function' ? msg.getType() : msg._getType();
    if (type === 'human') return 'user';
    if (type === 'ai') return 'assistant';
    return type; // system | tool | generic | remove
  } catch {
    return 'unknown';
  }
}

function truncateString(str, max = MAX_STRING_CHARS) {
  if (str.startsWith('data:') && str.length > 200) {
    const mime = str.slice(5, str.indexOf(';') > 0 ? str.indexOf(';') : 30);
    return `[${mime || 'data'} data URL, ${str.length} chars]`;
  }
  if (str.length > 500 && !/\s/.test(str) && /^[A-Za-z0-9+/=_-]+$/.test(str)) {
    return `[base64 data, ${str.length} chars]`;
  }
  if (str.length <= max) return str;
  return `${str.slice(0, max)}… [${str.length - max} more chars]`;
}

function prune(value, depth, seen) {
  if (value === null || value === undefined) return value ?? null;
  const t = typeof value;
  if (t === 'string') return truncateString(value);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') return value.toString();
  if (t === 'function' || t === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error)
    return { error: value.name, message: truncateString(value.message || '') };
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))
    return `[binary ${value.length} bytes]`;
  if (ArrayBuffer.isView(value)) return `[binary ${value.byteLength} bytes]`;

  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[…]';
  seen.add(value);

  try {
    if (isMessage(value)) {
      const out = { role: messageRole(value), content: prune(value.content, depth + 1, seen) };
      if (value.name) out.name = value.name;
      if (Array.isArray(value.tool_calls) && value.tool_calls.length > 0) {
        out.tool_calls = value.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: prune(tc.args, depth + 2, seen),
        }));
      }
      if (value.tool_call_id) out.tool_call_id = value.tool_call_id;
      return out;
    }

    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => prune(v, depth + 1, seen));
      if (value.length > MAX_ARRAY_ITEMS)
        items.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
      return items;
    }

    if (value instanceof Map) {
      return prune(Object.fromEntries(value), depth, seen);
    }

    const out = {};
    const keys = Object.keys(value);
    for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
      if (SECRET_KEY_RE.test(key)) {
        out[key] = '***';
        continue;
      }
      if (
        (key === 'data' || key === 'base64') &&
        typeof value[key] === 'string' &&
        value[key].length > 100 &&
        (value.type === 'image' || value.type === 'base64' || value.mimeType || value.media_type)
      ) {
        out[key] = `[${value.mimeType || value.media_type || 'image'} base64, ${value[key].length} chars]`;
        continue;
      }
      const v = prune(value[key], depth + 1, seen);
      if (v !== undefined) out[key] = v;
    }
    if (keys.length > MAX_OBJECT_KEYS) out['…'] = `${keys.length - MAX_OBJECT_KEYS} more keys`;
    return out;
  } finally {
    seen.delete(value);
  }
}

/**
 * @param {*} value
 * @param {number} [maxChars=16000] cap on the stringified result
 * @returns {*} a JSON-safe value (or a truncated preview string)
 */
export function serializeForTrace(value, maxChars = 16000) {
  if (value === undefined) return null;
  let pruned;
  try {
    pruned = prune(value, 0, new WeakSet());
  } catch {
    return '[unserializable]';
  }
  if (typeof pruned === 'string') return truncateString(pruned, maxChars);
  let json;
  try {
    json = JSON.stringify(pruned);
  } catch {
    return '[unserializable]';
  }
  if (json === undefined) return null;
  if (json.length <= maxChars) return pruned;
  return `${json.slice(0, maxChars)}… [truncated, ${json.length} chars total]`;
}

/**
 * Plain text of a message `content` (string, or an array of content blocks).
 * When only non-text parts (like images) exist, returns descriptive labels.
 */
export function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const texts = content
      .map((part) => (typeof part === 'string' ? part : part?.type === 'text' ? part.text : ''))
      .filter(Boolean);
    if (texts.length > 0) return texts.join('');
    const nonText = content
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        if (part.type === 'image' || part.type === 'image_url') {
          const name = part.name || part.filename || part.mimeType || '';
          return name ? `[image: ${name}]` : '[image]';
        }
        if (part.type && part.type !== 'text') return `[${part.type}]`;
        return '';
      })
      .filter(Boolean);
    if (nonText.length > 0) return nonText.join(' ');
  }
  return '';
}

export default serializeForTrace;
