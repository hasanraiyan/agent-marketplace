import { StateBackend } from 'deepagents';

export class VersionedStateBackend extends StateBackend {
  async edit(filePath, oldString, newString, replaceAll = false) {
    try {
      // 1. Read the current content of the file before editing
      const readRes = await this.read(filePath);
      if (readRes && !readRes.error && readRes.content !== undefined) {
        const currentContent = typeof readRes.content === 'string'
          ? readRes.content
          : new TextDecoder().decode(readRes.content);

        // 2. Generate the backup file name in a hidden directory
        // E.g., "/src/index.js" -> "/.versions/src/index.js.v1", "/.versions/src/index.js.v2", etc.
        const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
        const versionsDir = '/.versions';

        let version = 1;
        let backupPath;
        while (true) {
          backupPath = `${versionsDir}${normalizedPath}.v${version}`;
          const check = await this.read(backupPath);
          if (check && check.error) {
            // File does not exist, so version number is free
            break;
          }
          version++;
        }

        // 3. Write the backup file containing the previous content
        await this.write(backupPath, currentContent);
      }
    } catch (err) {
      console.error('[VersionedStateBackend] Failed to create version backup:', err);
    }

    // 4. Proceed with the standard edit operation
    return super.edit(filePath, oldString, newString, replaceAll);
  }
}
