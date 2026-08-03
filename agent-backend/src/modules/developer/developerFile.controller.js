import path from 'path';
import fileService, { developerUploadDir } from '../files/file.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform file upload/mediated access (blueprint Phase 9 §15,
 * PR-47d). Every route is `ProjectRuntimeContext`-only — enforced by a
 * router-level guard (`developerFile.routes.js`), same pattern as Thread's
 * PR-40: a file's Subject is a person, and only an asserted external user
 * has one.
 *
 * `download` is the mediated-access endpoint AD-05 §20/AD-07 §22 require —
 * `fileService.getFileForDownload` verifies the requester's own
 * `(domain, externalUserId)` before this ever streams a byte; there is no
 * bare static URL anywhere in this module (contrast with the existing
 * avatar path's `/uploads/{filename}`, which stays exactly as-is for
 * Persona — unrelated, lower-risk, not retrofitted here).
 */
class DeveloperFileController {
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const file = await fileService.createFile(req.projectContext, req.file, {
        agentId: req.body.agentId,
        threadId: req.body.threadId,
      });

      res.status(201).json({
        success: true,
        data: {
          id: file._id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          agentId: file.agentId,
          threadId: file.threadId,
          createdAt: file.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const [files, total] = await Promise.all([
        fileService.listFiles(req.projectContext, { page, limit }),
        fileService.countFiles(req.projectContext),
      ]);
      const formatted = files.map((file) => ({
        id: file._id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        agentId: file.agentId,
        threadId: file.threadId,
        createdAt: file.createdAt,
      }));

      res.json({ success: true, data: paginationEnvelope(formatted, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async download(req, res, next) {
    try {
      const file = await fileService.getFileForDownload(req.params.fileId, req.projectContext);
      const storagePath = path.join(developerUploadDir, file.storageKey);

      res.download(storagePath, file.originalName, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await fileService.deleteFile(req.params.fileId, req.projectContext);
      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        fileService.deleteFile(id, req.projectContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperFileController();
