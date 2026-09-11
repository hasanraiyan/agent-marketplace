/**
 * Template variable resolver for workflow state interpolation.
 * Supports:
 * - Direct object reference: "{{steps.node1.output}}" -> returns the raw output value/object
 * - String interpolation: "Hello {{trigger.payload.name}}, order {{steps.tool1.output.id}}"
 * - Safe dot-notation path navigation (e.g. "steps.agent.output.text")
 * - Deep object/array resolution
 */

/**
 * Extracts a value from an object given a dot-separated or array-indexed path.
 * e.g. "steps.agent1.output.text" or "trigger.payload.items[0].id"
 */
export function getByPath(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined;

  // Normalize array index brackets to dots: foo[0].bar -> foo.0.bar
  const normalizedPath = String(path).replace(/\[(\w+)\]/g, '.$1');
  const parts = normalizedPath.split('.').filter(Boolean);

  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

const TEMPLATE_REGEX = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/**
 * Resolves a template value against state.
 * If template is a string exactly matching `{{variable}}`, returns the raw resolved value.
 * If template contains multiple placeholders or surrounding text, returns interpolated string.
 * If template is an object or array, recursively resolves properties.
 */
export function resolveTemplate(template, state) {
  if (template === null || template === undefined) {
    return template;
  }

  if (typeof template === 'string') {
    const trimmed = template.trim();
    // Check if the entire string is a single {{path}}
    const exactMatch = trimmed.match(/^\{\{\s*([^{}\s]+)\s*\}\}$/);
    if (exactMatch) {
      const resolved = getByPath(state, exactMatch[1]);
      return resolved !== undefined ? resolved : '';
    }

    // Otherwise, replace all occurrences inside the string
    return template.replace(TEMPLATE_REGEX, (_, path) => {
      const val = getByPath(state, path);
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') {
        try {
          return JSON.stringify(val);
        } catch {
          return String(val);
        }
      }
      return String(val);
    });
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolveTemplate(item, state));
  }

  if (typeof template === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = resolveTemplate(value, state);
    }
    return result;
  }

  return template;
}

/**
 * Extracts all variable paths referenced in a template.
 * Useful for graph linting and validation.
 */
export function extractTemplateVariables(template) {
  const vars = new Set();

  function scan(val) {
    if (typeof val === 'string') {
      let match;
      const regex = new RegExp(TEMPLATE_REGEX);
      while ((match = regex.exec(val)) !== null) {
        vars.add(match[1]);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) scan(item);
    } else if (val && typeof val === 'object') {
      for (const item of Object.values(val)) scan(item);
    }
  }

  scan(template);
  return Array.from(vars);
}
