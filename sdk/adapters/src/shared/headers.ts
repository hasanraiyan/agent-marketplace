export function redactHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const redacted: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    if (k.toLowerCase() === 'authorization') redacted[k] = '***';
    else redacted[k] = v;
  }
  return redacted;
}
