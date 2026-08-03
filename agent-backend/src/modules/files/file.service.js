import path from 'path';
import fs from 'fs/promises';
import fileRepository from './file.repository.js';

/**
 * Developer Platform file storage (blueprint Phase 9 §15, PR-47d).
 *
 * Local disk storage, same underlying mechanism as the existing avatar
 * upload path (`modules/upload`) — but DELIBERATELY a sibling of `uploads/`,
 * not a subdirectory of it: `index.js` serves `uploads/` in its entirety via
 * `express.static`, so a `uploads/developer/` subdirectory would have been
 * reachable at the exact same bare static URL this module exists to avoid
 * (AD-05 §20, AD-07 §22 — retrieval must always be mediated). Every read
 * goes through `getFileForDownload`'s `(domain, externalUserId)` check
 * first; this directory is never registered with `express.static`.
 */
export const developerUploadDir = path.join(process.cwd(), 'developer-uploads');

class FileService {
  /**
   * Persists a durable file record for an already-disk-written multer file.
   * `context` must be a `ProjectRuntimeContext` — files only ever belong to
   * a Project's own external-user Subject (no Persona/Project-machine form
   * exists, per blueprint §15/AD-04 §15).
   */
  async createFile(context, multerFile, { agentId, threadId } = {}) {
    return await fileRepository.create({
      domain: context.domain,
      externalUserId: context.externalUserId,
      agentId: agentId || null,
      threadId: threadId || null,
      storageKey: multerFile.filename,
      originalName: multerFile.originalname,
      mimeType: multerFile.mimetype,
      size: multerFile.size,
    });
  }

  /**
   * Fetches a file record with a mediated access check — the requester's
   * `(domain, externalUserId)` must match the file's own, else this
   * collapses to the same "not found" as a genuinely nonexistent file
   * (existence-hiding, AD-07 §29). Never a bare static URL.
   */
  async getFileForDownload(fileId, context) {
    const file = await fileRepository.findById(fileId);
    if (!file || file.domain !== context.domain || file.externalUserId !== context.externalUserId) {
      throw new Error('File not found');
    }
    return file;
  }

  async listFiles(context, pagination) {
    return await fileRepository.findBySubject(
      { domain: context.domain, externalUserId: context.externalUserId },
      pagination
    );
  }

  /** Developer Platform only (Feature 4, pagination envelope) — the real total behind `listFiles`'s page. */
  async countFiles(context) {
    return await fileRepository.countBySubject({
      domain: context.domain,
      externalUserId: context.externalUserId,
    });
  }

  async deleteFile(fileId, context) {
    const file = await this.getFileForDownload(fileId, context);
    const storagePath = path.join(developerUploadDir, file.storageKey);
    await fs.unlink(storagePath).catch(() => {});
    await fileRepository.deleteById(fileId);
    return true;
  }
}

export default new FileService();
