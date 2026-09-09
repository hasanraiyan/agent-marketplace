import type { Logger } from '@personaai/logger';
import { TranslationError } from './errors.js';

export async function readJsonBody(req: any, logger?: Logger): Promise<unknown> {
  const log = logger?.child('translate');
  log?.trace('readJsonBody start', { readableEnded: req.readableEnded });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) {
    log?.trace('readJsonBody empty stream');
    return undefined;
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) {
    log?.trace('readJsonBody empty text');
    return undefined;
  }
  log?.debug('readJsonBody raw text length', { length: text.length });
  try {
    const parsed = JSON.parse(text);
    log?.trace('readJsonBody parsed', {
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : undefined,
    });
    return parsed;
  } catch (err) {
    log?.error('readJsonBody invalid JSON', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new TranslationError('Request body is not valid JSON.');
  }
}
