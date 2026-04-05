import { jest } from '@jest/globals';
import { generateSecret, formatEnvLines, runCli } from '../scripts/generate-auth-secrets.js';

describe('generate auth secrets script', () => {
  test('generateSecret creates a 128-char hex string (64 bytes)', () => {
    const secret = generateSecret(() => Buffer.alloc(64, 5));
    expect(secret).toBe(Buffer.alloc(64, 5).toString('hex'));
    expect(secret.length).toBe(128);
  });

  test('formatEnvLines returns copy-paste ready env assignments', () => {
    const output = formatEnvLines({
      jwtSecret: 'aaa',
      jwtRefreshSecret: 'bbb',
    });
    expect(output).toBe('JWT_SECRET=aaa\nJWT_REFRESH_SECRET=bbb');
  });

  test('runCli prints two secrets', () => {
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };

    const exitCode = runCli({ argv: [], stdout, stderr });

    expect(exitCode).toBe(0);
    expect(stderr.write).not.toHaveBeenCalled();
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringMatching(/^JWT_SECRET=[a-f0-9]{128}\nJWT_REFRESH_SECRET=[a-f0-9]{128}\n$/)
    );
  });

  test('runCli shows help with --help', () => {
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };

    const exitCode = runCli({ argv: ['--help'], stdout, stderr });

    expect(exitCode).toBe(0);
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  test('runCli rejects unexpected arguments', () => {
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };

    const exitCode = runCli({ argv: ['--foo'], stdout, stderr });

    expect(exitCode).toBe(1);
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining('Unexpected argument'));
  });
});
