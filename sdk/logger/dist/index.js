// src/logger.ts
var LEVEL_ORDER = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5
};
var globalLevel = "off";
function setLogLevel(level) {
  globalLevel = level;
}
function getLogLevel() {
  return globalLevel;
}
function isLevelEnabled(current, target) {
  if (current === "off") return false;
  return LEVEL_ORDER[target] <= LEVEL_ORDER[current];
}
function defaultTransport(level, namespace, message, meta) {
  const prefix = `[${namespace}] ${message}`;
  const hasMeta = meta && Object.keys(meta).length > 0;
  const c = typeof console !== "undefined" ? console : null;
  if (!c) return;
  const payload = hasMeta ? [prefix, meta] : [prefix];
  switch (level) {
    case "error":
      (c.error ?? c.log).apply(c, payload);
      break;
    case "warn":
      (c.warn ?? c.log).apply(c, payload);
      break;
    case "info":
      (c.info ?? c.log).apply(c, payload);
      break;
    case "debug":
    case "trace":
      (c.debug ?? c.log).apply(c, payload);
      break;
    default:
      c.log.apply(c, payload);
  }
}
function createLogger(namespace, opts = {}) {
  const explicitLevel = opts.level;
  const transport = opts.transport ?? defaultTransport;
  const getEffectiveLevel = () => explicitLevel ?? getLogLevel();
  const log = (level, message, meta) => {
    const eff = getEffectiveLevel();
    if (!isLevelEnabled(eff, level)) return;
    try {
      transport(level, namespace, message, meta);
    } catch {
    }
  };
  const logger = {
    get namespace() {
      return namespace;
    },
    get level() {
      return getEffectiveLevel();
    },
    trace(message, meta) {
      log("trace", message, meta);
    },
    debug(message, meta) {
      log("debug", message, meta);
    },
    info(message, meta) {
      log("info", message, meta);
    },
    warn(message, meta) {
      log("warn", message, meta);
    },
    error(message, meta) {
      log("error", message, meta);
    },
    child(subNamespace) {
      const childNs = subNamespace ? `${namespace}:${subNamespace}` : namespace;
      return createLogger(childNs, opts);
    }
  };
  return logger;
}
function createNoopLogger(namespace = "noop") {
  return createLogger(namespace, { level: "off", transport: () => {
  } });
}
export {
  createLogger,
  createNoopLogger,
  getLogLevel,
  isLevelEnabled,
  setLogLevel
};
//# sourceMappingURL=index.js.map