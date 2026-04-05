import crypto from 'crypto';
import { fileURLToPath } from 'url';

const SECRET_BYTES = 64;

export function generateSecret(bytesFn = crypto.randomBytes) {
  return bytesFn(SECRET_BYTES).toString('hex');
}

export function formatEnvLines({
  jwtSecret = generateSecret(),
  jwtRefreshSecret = generateSecret(),
} = {}) {
  return `JWT_SECRET=${jwtSecret}\nJWT_REFRESH_SECRET=${jwtRefreshSecret}`;
}

function parseArgs(argv) {
  const options = {
    help: false,
  };

  for (const argument of argv) {
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unexpected argument: ${argument}`);
  }

  return options;
}

export function runCli({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const options = parseArgs(argv);

    if (options.help) {
      stdout.write(
        'Usage: pnpm run auth:secrets\n' +
          'Generates JWT_SECRET and JWT_REFRESH_SECRET and prints env assignments.\n'
      );
      return 0;
    }

    stdout.write(`${formatEnvLines()}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
