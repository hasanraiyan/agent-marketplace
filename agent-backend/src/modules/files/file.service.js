import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import mongoose from 'mongoose';
import fileRepository from './file.repository.js';
import { s3Service } from '../../services/storage/index.js';

/**
 * Developer Platform file storage (blueprint Phase 9 §15, PR-47d).
 *
 * Backed by S3-compatible object storage (MinIO in local dev, S3 in prod).
 * Retrieval must always be mediated through `getFileForDownload`'s
 * `(domain, externalUserId)` check first; files are never exposed via bare static URLs.
 */
export const developerUploadDir = path.join(process.cwd(), 'developer-uploads');

class FileService {
  /**
   * Persists a durable file record and uploads its bytes to S3.
   * `context` must be a `ProjectRuntimeContext` — files only ever belong to
   * a Project's own external-user Subject.
   */
  async createFile(context, multerFile, { agentId, threadId } = {}) {
    const ext = path.extname(multerFile.originalname || '').slice(0, 10);
    const storageKey = multerFile.filename || `${crypto.randomUUID()}${ext}`;

    if (multerFile.buffer) {
      await s3Service.uploadBuffer({
        bucket: s3Service.privateBucket,
        key: `files/${storageKey}`,
        buffer: multerFile.buffer,
        contentType: multerFile.mimetype,
      });
    }

    return await fileRepository.create({
      domain: context.domain,
      externalUserId: context.externalUserId,
      agentId: agentId || null,
      threadId: threadId || null,
      storageKey,
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

    // Delete from S3
    await s3Service.deleteObject({
      bucket: s3Service.privateBucket,
      key: `files/${file.storageKey}`,
    }).catch(() => {});

    // Clean up local disk if legacy file exists
    const storagePath = path.join(developerUploadDir, file.storageKey);
    await fsp.unlink(storagePath).catch(() => {});

    await fileRepository.deleteById(fileId);
    return true;
  }

  // ── Chat attachments (agui/userContent.js) ────────────────────────────────
  // `subject` is `{ domain, externalUserId }` — a ProjectRuntimeContext's own,
  // or a synthetic one for Persona/Project-internal callers.

  /** A file record owned by `subject`, or null (existence-hiding, like getFileForDownload). */
  async getOwnedFile(fileId, subject) {
    if (!subject || !mongoose.isValidObjectId(fileId)) return null;
    const file = await fileRepository.findById(fileId);
    if (!file || file.domain !== subject.domain || file.externalUserId !== subject.externalUserId) {
      return null;
    }
    return file;
  }

  /** Raw bytes of a stored file. Reads from S3, falling back to local disk for legacy files. */
  async readFileBytes(file) {
    const key = `files/${path.basename(file.storageKey)}`;
    try {
      return await s3Service.getBuffer({ bucket: s3Service.privateBucket, key });
    } catch (err) {
      // Graceful fallback to local disk for pre-migration files
      const localPath = path.join(developerUploadDir, path.basename(file.storageKey));
      if (fs.existsSync(localPath)) {
        return await fsp.readFile(localPath);
      }
      throw err;
    }
  }

  /** Returns a readable stream for file download (S3 stream or local stream fallback). */
  async getFileReadStream(file, range) {
    const key = `files/${path.basename(file.storageKey)}`;
    try {
      const s3Stream = await s3Service.getReadStream({
        bucket: s3Service.privateBucket,
        key,
        range,
      });
      return {
        stream: s3Stream.stream,
        contentType: s3Stream.contentType || file.mimeType,
        contentLength: s3Stream.contentLength || file.size,
      };
    } catch (err) {
      const localPath = path.join(developerUploadDir, path.basename(file.storageKey));
      if (fs.existsSync(localPath)) {
        return {
          stream: fs.createReadStream(localPath),
          contentType: file.mimeType,
          contentLength: file.size,
        };
      }
      throw err;
    }
  }

  /** Persists an in-memory image (an inline AG-UI part) as an attachment record in S3. */
  async createAttachmentFromBuffer(subject, { buffer, mimeType, name, agentId }) {
    const ext = ATTACHMENT_EXTENSIONS[mimeType] || '';
    const storageKey = `${crypto.randomUUID()}${ext}`;

    await s3Service.uploadBuffer({
      bucket: s3Service.privateBucket,
      key: `files/${storageKey}`,
      buffer,
      contentType: mimeType,
    });

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
