import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import mongoose from 'mongoose';
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

  // ── Chat attachments (agui/userContent.js) ────────────────────────────────
  // `subject` is `{ domain, externalUserId }` — a ProjectRuntimeContext's own,
  // or a synthetic one for Persona/Project-internal callers (see
  // attachmentSubject in userContent.js). Same mediated, subject-checked
  // model as downloads; never a static URL.

  /** A file record owned by `subject`, or null (existence-hiding, like getFileForDownload). */
  async getOwnedFile(fileId, subject) {
    if (!subject || !mongoose.isValidObjectId(fileId)) return null;
    const file = await fileRepository.findById(fileId);
    if (!file || file.domain !== subject.domain || file.externalUserId !== subject.externalUserId) {
      return null;
    }
    return file;
  }

  /** Raw bytes of a stored file. Throws if the file is missing on disk. */
  async readFileBytes(file) {
    return await fs.readFile(path.join(developerUploadDir, path.basename(file.storageKey)));
  }

  /** Persists an in-memory image (an inline AG-UI part) as an attachment record. */
  async createAttachmentFromBuffer(subject, { buffer, mimeType, name, agentId }) {
    const ext = ATTACHMENT_EXTENSIONS[mimeType] || '';
    const storageKey = `${crypto.randomUUID()}${ext}`;
    await fs.mkdir(developerUploadDir, { recursive: true });
    await fs.writeFile(path.join(developerUploadDir, storageKey), buffer);
    return await fileRepository.create({
      domain: subject.domain,
      externalUserId: subject.externalUserId,
      agentId: agentId || null,
      storageKey,
      originalName: (name || `image${ext}`).slice(0, 255),
      mimeType,
      size: buffer.length,
      kind: 'attachment',
    });
  }

  /** Marks files as attached in a LangGraph thread (idempotent). */
  async bindAttachmentsToThread(fileIds, threadKey) {
    if (!threadKey || !fileIds?.length) return;
    await fileRepository.bindToThread(fileIds, threadKey);
  }

  /** Attachment records visible in a thread's /uploads/ folder. */
  async listThreadAttachments(threadKey) {
    if (!threadKey) return [];
    return await fileRepository.findByThreadKey(threadKey);
  }
}

const ATTACHMENT_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export default new FileService();
