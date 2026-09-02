/**
 * Isomorphic logger for the Persona SDK ecosystem — zero dependencies, Node + browser safe.
 *
 * - OFF by default (no output unless caller opts in).
 * - Selectable per instance (`logLevel` / `logger`) or globally via `setLogLevel`.
 * - Every level visible: off < error < warn < info < debug < trace
 * - Secrets are never logged — callers must redact before calling.
 */

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_ORDER: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

let globalLevel: LogLevel = 'off';

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function getLogLevel(): LogLevel {
  return globalLevel;
}

export function isLevelEnabled(current: LogLevel, target: Exclude<LogLevel, 'off'>): boolean {
  if (current === 'off') return false;
  return LEVEL_ORDER[target] <= LEVEL_ORDER[current];
}

export type LogTransport = (
  level: Exclude<LogLevel, 'off'>,
  namespace: string,
  message: string,
  meta?: Record<string, unknown>
) => void;

function defaultTransport(
  level: Exclude<LogLevel, 'off'>,
  namespace: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const prefix = `[${namespace}] ${message}`;
  const hasMeta = meta && Object.keys(meta).length > 0;
  type ConsoleLike = {
    log: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
  };
  const c = typeof console !== 'undefined' ? (console as unknown as ConsoleLike) : null;
  if (!c) return;
  const payload: unknown[] = hasMeta ? [prefix, meta] : [prefix];
  switch (level) {
    case 'error':
      (c.error ?? c.log).apply(c, payload);
      break;
    case 'warn':
      (c.warn ?? c.log).apply(c, payload);
      break;
    case 'info':
      (c.info ?? c.log).apply(c, payload);
      break;
    case 'debug':
    case 'trace':
      (c.debug ?? c.log).apply(c, payload);
      break;
    default:
      // eslint-disable-next-line prefer-spread
      c.log.apply(c, payload);
  }
}

export interface CreateLoggerOptions {
  /** Override level for this logger instance. Falls back to global level (default 'off'). */
  level?: LogLevel;
  /** Custom transport — receives level/namespace/message/meta. Defaults to console. */
  transport?: LogTransport;
}

export interface Logger {
  readonly namespace: string;
  /** Effective level if explicitly set on this logger, otherwise the current global level. */
  readonly level: LogLevel;
  trace(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(subNamespace: string): Logger;
}

/**
 * Create a namespaced logger. When `level` is omitted the logger follows the
 * global level set via `setLogLevel()` — changing the global level affects
 * all such loggers without needing to recreate them.
 */
export function createLogger(namespace: string, opts: CreateLoggerOptions = {}): Logger {
  const explicitLevel = opts.level;
  const transport = opts.transport ?? defaultTransport;

  const getEffectiveLevel = (): LogLevel => explicitLevel ?? getLogLevel();

  const log = (
    level: Exclude<LogLevel, 'off'>,
    message: string,
    meta?: Record<string, unknown>
  ): void => {
    const eff = getEffectiveLevel();
    if (!isLevelEnabled(eff, level)) return;
    try {
      transport(level, namespace, message, meta);
    } catch {
      // Transport errors must never break SDK operation.
    }
  };

  const logger: Logger = {
    get namespace() {
      return namespace;
    },
    get level() {
      return getEffectiveLevel();
    },
    trace(message, meta) {
      log('trace', message, meta);
    },
    debug(message, meta) {
      log('debug', message, meta);
    },
    info(message, meta) {
      log('info', message, meta);
    },
    warn(message, meta) {
      log('warn', message, meta);
    },
    error(message, meta) {
      log('error', message, meta);
    },
    child(subNamespace: string) {
      const childNs = subNamespace ? `${namespace}:${subNamespace}` : namespace;
      return createLogger(childNs, opts);
    },
  };

  return logger;
}

/**
 * No-op logger — never emits regardless of global level. Useful for tests
 * or when a caller wants to explicitly silence a subsystem.
 */
export function createNoopLogger(namespace = 'noop'): Logger {
  return createLogger(namespace, { level: 'off', transport: () => {} });
}
