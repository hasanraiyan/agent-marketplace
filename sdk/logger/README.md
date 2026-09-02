# @personaai/logger

Isomorphic, zero-dependency logger for the Persona SDK ecosystem — OFF by default, selectable levels, child namespaces, browser+Node safe.

## Install

```bash
npm install @personaai/logger
```

## Usage

```ts
import { createLogger, setLogLevel } from '@personaai/logger';

// Global
setLogLevel('debug'); // 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

// Per-instance
const logger = createLogger('my-app', { level: 'debug' });
logger.info('hello', { foo: 'bar' });

// Child
const child = logger.child('http');
child.debug('request start', { method: 'GET', path: '/api' });

// Custom transport
const logger2 = createLogger('my-app', {
  level: 'debug',
  transport: (level, namespace, message, meta) => {
    console.log(`[${level}] [${namespace}] ${message}`, meta);
  },
});
```

Levels: `off < error < warn < info < debug < trace` — every level includes those above it. Nothing logs when `off`.

## License

MIT
