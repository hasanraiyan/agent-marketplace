/**
 * Response-field mapping for the REST API Tool Builder
 * (PERSONA_REST_TOOL_REQUEST.md item 3): `@field.path` dot-path extraction
 * from a tool call's JSON response, so the agent gets a small named
 * result instead of the raw upstream payload.
 */

const MAPPING_PATH_PATTERN = /^@[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

/** Save-time validator for `responseMappings[].path`. */
export function isValidMappingPath(path) {
  return typeof path === 'string' && MAPPING_PATH_PATTERN.test(path);
}

/**
 * `path`: "@data.user.name" or "@items.0.id" (numeric segments index
 * arrays). Never throws — a missing/invalid path resolves to `undefined`,
 * so one bad mapping degrades gracefully instead of failing the whole
 * tool call.
 */
export function extractField(responseBody, path) {
  if (typeof path !== 'string' || !path.startsWith('@')) return undefined;

  const segments = path.slice(1).split('.').filter(Boolean);
  let cur = responseBody;
  for (const segment of segments) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[segment];
  }
  return cur;
}

/**
 * If `responseMappings` is empty, returns `responseBody` unchanged —
 * mapping is an opt-in narrowing/renaming step, not a requirement.
 */
export function applyResponseMappings(responseBody, responseMappings) {
  if (!responseMappings || responseMappings.length === 0) return responseBody;

  const out = {};
  for (const { field, path } of responseMappings) {
    out[field] = extractField(responseBody, path);
  }
  return out;
}
