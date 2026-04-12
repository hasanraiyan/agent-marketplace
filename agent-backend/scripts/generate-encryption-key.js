import crypto from 'crypto';
import { fileURLToPath } from 'url';

const KEY_BYTES = 32;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function generateKeyId(date = new Date()) {
  const compactIso = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/u, 'Z');
  return `key_${compactIso}`;
}

export function generateEncodedKey(randomBytesFn = crypto.randomBytes) {
  return `base64:${randomBytesFn(KEY_BYTES).toString('base64')}`;
}

export function parseExistingKeys(rawValue) {
  if (!rawValue || rawValue.trim() === '') {
    return {};
  }

  let parsed;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('DB_ENCRYPTION_KEYS must be valid JSON to rotate keys');
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('DB_ENCRYPTION_KEYS must be a JSON object to rotate keys');
  }

  return parsed;
}

export function validateKeyId(keyId) {
  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new Error('Key id must be a non-empty string');
  }

  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error('Key id may only contain letters, numbers, underscores, and hyphens');
  }
}

export function buildKeyConfig(
  { keyId = generateKeyId(), existingKeys = {}, force = false } = {},
  randomBytesFn = crypto.randomBytes
) {
  validateKeyId(keyId);

  if (Object.hasOwn(existingKeys, keyId) && !force) {
    throw new Error(`Key "${keyId}" already exists. Choose a new id or rerun with --force.`);
  }

  return {
    keyId,
    keys: {
      ...existingKeys,
      [keyId]: generateEncodedKey(randomBytesFn),
    },
  };
}

export function formatEnvLines({ keyId, keys }) {
  return `DB_ENCRYPTION_ACTIVE_KEY_ID=${keyId}\nDB_ENCRYPTION_KEYS=${JSON.stringify(keys)}`;
}

function parseArgs(argv) {
  const options = {
    force: false,
    help: false,
    keyId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--force') {
      options.force = true;
      continue;
    }

    if (argument === '--key-id') {
      options.keyId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument.startsWith('--key-id=')) {
      options.keyId = argument.slice('--key-id='.length);
      continue;
    }

    if (!options.keyId) {
      options.keyId = argument;
      continue;
    }

    throw new Error(`Unexpected argument: ${argument}`);
  }

  return options;
}

export function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const options = parseArgs(argv);

    if (options.help) {
      stdout.write(
        'Usage: pnpm run encryption:keygen [key-id] [--force]\n' +
          'Generates a new base64-prefixed 32-byte key and prints env assignments.\n'
      );
      return 0;
    }

    const existingKeys = parseExistingKeys(env.DB_ENCRYPTION_KEYS);
    const config = buildKeyConfig(
      {
        keyId: options.keyId ?? generateKeyId(),
        existingKeys,
        force: options.force,
      },
      crypto.randomBytes
    );

    stdout.write(`${formatEnvLines(config)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
