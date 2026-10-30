import type { Logger } from '@personaai/logger';
import { TranslationError } from './errors.js';

export async function readBody(
  req: any,
  contentType: string = '',
  logger?: Logger,
): Promise<unknown> {
  const log = logger?.child('translate');
  log?.trace('readBody start', { readableEnded: req.readableEnded });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) {
    log?.trace('readBody empty stream');
    return undefined;
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) {
    log?.trace('readBody empty text');
    return undefined;
  }
  log?.debug('readBody raw text length', { length: text.length });
  if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      obj[key] = value;
    }
    log?.trace('readBody parsed urlencoded', { keys: Object.keys(obj) });
    return obj;
  }
  try {
    const parsed = JSON.parse(text);
    log?.trace('readBody parsed', {
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : undefined,
    });
    return parsed;
  } catch (err) {
    log?.error('readBody invalid JSON', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new TranslationError('Request body is not valid JSON.');
  }
}

export const readJsonBody = (req: any, logger?: Logger) => readBody(req, '', logger);
