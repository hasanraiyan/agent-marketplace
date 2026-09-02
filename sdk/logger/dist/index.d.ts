/**
 * Isomorphic logger for the Persona SDK ecosystem — zero dependencies, Node + browser safe.
 *
 * - OFF by default (no output unless caller opts in).
 * - Selectable per instance (`logLevel` / `logger`) or globally via `setLogLevel`.
 * - Every level visible: off < error < warn < info < debug < trace
 * - Secrets are never logged — callers must redact before calling.
 */
type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
declare function setLogLevel(level: LogLevel): void;
declare function getLogLevel(): LogLevel;
declare function isLevelEnabled(current: LogLevel, target: Exclude<LogLevel, 'off'>): boolean;
type LogTransport = (level: Exclude<LogLevel, 'off'>, namespace: string, message: string, meta?: Record<string, unknown>) => void;
interface CreateLoggerOptions {
    /** Override level for this logger instance. Falls back to global level (default 'off'). */
    level?: LogLevel;
    /** Custom transport — receives level/namespace/message/meta. Defaults to console. */
    transport?: LogTransport;
}
interface Logger {
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
declare function createLogger(namespace: string, opts?: CreateLoggerOptions): Logger;
/**
 * No-op logger — never emits regardless of global level. Useful for tests
 * or when a caller wants to explicitly silence a subsystem.
 */
declare function createNoopLogger(namespace?: string): Logger;

export { type CreateLoggerOptions, type LogLevel, type LogTransport, type Logger, createLogger, createNoopLogger, getLogLevel, isLevelEnabled, setLogLevel };
