import { BaseSandbox } from 'deepagents';
import { CommandError } from '@codesandbox/sdk';

/**
 * Wraps a connected @codesandbox/sdk `SandboxClient` as a deepagents
 * `BaseSandbox`. `BaseSandbox` derives every filesystem tool (ls, read,
 * grep, glob, ...) from `execute()`, so this class only needs to implement
 * the primitives: `execute`, `uploadFiles`, `downloadFiles`, and `id`
 * (verified against deepagents@1.11.1's own `LangSmithSandbox` reference
 * implementation).
 */
export class CodeSandboxBackend extends BaseSandbox {
  #client;

  constructor(client) {
    super();
    this.#client = client;
  }

  /** The CodeSandbox sandbox id — required by deepagents' isSandboxBackend() check. */
  get id() {
    return this.#client.id;
  }

  /**
   * `commands.run()` returns the combined output string on success, but
   * *throws* `CommandError` (carrying `exitCode` and `output`) on a non-zero
   * exit — unlike deepagents' own `{ output, exitCode }` return shape, so
   * both paths are normalized here.
   */
  async execute(command) {
    try {
      const output = await this.#client.commands.run(command);
      return { output, exitCode: 0 };
    } catch (err) {
      if (err instanceof CommandError) {
        return { output: err.output, exitCode: err.exitCode };
      }
      throw err;
    }
  }

  async uploadFiles(files) {
    const responses = [];
    for (const [path, content] of files) {
      try {
        await this.#client.fs.writeFile(path, content, { create: true, overwrite: true });
        responses.push({ path, error: null });
      } catch {
        responses.push({ path, error: 'permission_denied' });
      }
    }
    return responses;
  }

  async downloadFiles(paths) {
    const responses = [];
    for (const path of paths) {
      try {
        const content = await this.#client.fs.readFile(path);
        responses.push({ path, content, error: null });
      } catch {
        responses.push({ path, content: null, error: 'file_not_found' });
      }
    }
    return responses;
  }

  /** Disconnects the SDK session (does not hibernate/delete the VM — it keeps its own idle TTL). */
  async close() {
    this.#client.dispose();
  }
}
