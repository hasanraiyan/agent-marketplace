import express from 'express';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import BaseError from '../../utils/errors/BaseError.js';
import { developerUploadDir } from '../files/file.service.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import developerFileController from './developerFile.controller.js';

/**
 * Developer file upload/mediated access routes (blueprint Phase 9 §15,
 * PR-47d) — a NEW capability, not a retrofit of `modules/upload`'s avatar
 * path (different purpose, different risk profile; the avatar path stays
 * exactly as-is for Persona). Every route requires a ProjectRuntimeContext
 * — a file's Subject is a person uploading it, and only an asserted
 * external user (x-persona-external-user-id) has one, mirroring
 * developerThread.routes.js's identical requirement (PR-40) exactly.
 */
const router = express.Router();

if (!fs.existsSync(developerUploadDir)) {
  fs.mkdirSync(developerUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, developerUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

router.use(developerMachineAuthMiddleware);

router.use((req, res, next) => {
  if (req.projectContext?.principalType !== 'ProjectRuntime') {
    return next(
      new BaseError(
        'File upload/access requires an asserted external user (x-persona-external-user-id)',
        400,
        'EXTERNAL_USER_REQUIRED'
      )
    );
  }
  next();
});

/**
 * @openapi
 * /api/v1/developer/files:
 *   post:
 *     tags: [Developer]
 *     summary: Upload a file
 *     description: >
 *       Requires a ProjectRuntimeContext. Retrieval is always mediated
 *       through GET /api/v1/developer/files/{fileId} — never a bare
 *       static URL.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               agentId: { type: string }
 *               threadId: { type: string }
 *     responses:
 *       201: { description: File uploaded }
 *       400: { description: "No file uploaded, or no asserted external user" }
 *   get:
 *     tags: [Developer]
 *     summary: List the asserted external user's own uploaded files
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ items: PersonaFile[], pagination: { total, page, limit, pages } }" }
 */
router.post('/', upload.single('file'), developerFileController.upload);
router.get('/', developerFileController.list);

/**
 * @openapi
 * /api/v1/developer/files/{fileId}:
 *   get:
 *     tags: [Developer]
 *     summary: Download a file (mediated access — Subject only)
 *     description: >
 *       Never a bare static URL — the requester's own
 *       (domain, externalUserId) must match the file's, or this
 *       existence-hides to the same 404 as a nonexistent file.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: fileId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: File content stream }
 *       404: { description: File not found (or not visible to this Domain/Subject) }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a file (Subject only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: fileId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: File deleted }
 *       404: { description: File not found or unauthorized }
 */
router.get('/:fileId', developerFileController.download);
router.delete('/:fileId', developerFileController.remove);

/**
 * @openapi
 * /api/v1/developer/files/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple of the asserted external user's own files in one call
 *     description: >
 *       Best-effort batch delete — one not-found id doesn't abort the
 *       rest. Up to 100 ids per request.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string }
 *                 maxItems: 100
 *     responses:
 *       200: { description: "{ deleted: string[], failed: [{ id, reason }] }" }
 *       400: { description: "ids missing, empty, over 100 entries, or no asserted external user" }
 */
router.post('/bulk-delete', validateBody(bulkDeleteSchema), developerFileController.bulkDelete);

export default router;
