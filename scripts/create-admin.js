import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const SALT_ROUNDS = 10;

const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/agent-marketplace';

function parseArgs(argv) {
  const options = {
    name: 'Admin',
    email: null,
    password: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--name' || arg === '-n') {
      options.name = argv[++i];
      continue;
    }
    if (arg === '--email' || arg === '-e') {
      options.email = argv[++i];
      continue;
    }
    if (arg === '--password' || arg === '-p') {
      options.password = argv[++i];
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

function printHelp(stdout) {
  stdout.write(`Usage: pnpm run admin:create [options]
Creates an admin user in the database.

Options:
  --name, -n <name>     User name (default: "Admin")
  --email, -e <email>  User email (required)
  --password, -p <pw>  User password (required)
  --help, -h           Show this help message

Example:
  pnpm run admin:create --email admin@example.com --password secret123
`);
}

async function runCli({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  connect = mongoose.connect,
} = {}) {
  try {
    const options = parseArgs(argv);

    if (options.help) {
      printHelp(stdout);
      return 0;
    }

    if (!options.email) {
      stderr.write('Error: --email is required\n');
      printHelp(stdout);
      return 1;
    }

    if (!options.password) {
      stderr.write('Error: --password is required\n');
      printHelp(stdout);
      return 1;
    }

    stdout.write('Connecting to database...\n');
    await connect(DB_URI);

    stdout.write('Hashing password...\n');
    const hashedPassword = await bcrypt.hash(options.password, SALT_ROUNDS);

    stdout.write('Creating admin user...\n');
    const adminUser = await User.create({
      name: options.name,
      email: options.email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
    });

    stdout.write(`Admin user created successfully!\n`);
    stdout.write(`ID: ${adminUser._id}\n`);
    stdout.write(`Email: ${adminUser.email}\n`);

    await mongoose.disconnect();
    return 0;
  } catch (error) {
    stderr.write(`Error: ${error.message}\n`);
    try {
      await mongoose.disconnect();
    } catch {}
    return 1;
  }
}

export { runCli };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
