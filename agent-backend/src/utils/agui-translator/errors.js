// LangGraph throws an AggregateError ("Multiple errors occurred during superstep N")
// when 2+ parallel tasks fail in the same step — the real causes live in err.errors[],
// not err.message. Flatten the whole tree (AggregateError.errors + .cause) into the
// individual leaf errors so they can be logged and surfaced.
export function flattenErrors(err, seen = new Set()) {
  if (!err || seen.has(err)) return [];
  seen.add(err);
  const leaves = [];
  const children = [
    ...(Array.isArray(err.errors) ? err.errors : []),
    ...(err.cause ? [err.cause] : []),
  ];
  if (children.length === 0) {
    leaves.push(err);
  } else {
    for (const child of children) leaves.push(...flattenErrors(child, seen));
  }
  return leaves;
}

export function formatRuntimeError(err, providerConfig) {
  const rawMessage = err?.message || 'Unknown error';
  const lower = rawMessage.toLowerCase();

  const isProviderAuthIssue =
    lower.includes('incorrect api key provided') ||
    lower.includes('model_authentication') ||
    (lower.includes('401') && lower.includes('api key'));

  if (isProviderAuthIssue) {
    const providerLabel = providerConfig?.label || 'this provider';
    return `Provider "${providerLabel}" has invalid credentials. Update its API key in Settings and try again.`;
  }

  return rawMessage;
}
