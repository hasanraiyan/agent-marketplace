import express from 'express';
import multer from 'multer';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
} from '../knowledge/knowledge.validator.js';
import developerKnowledgeController from './developerKnowledge.controller.js';

/**
 * Developer Knowledge CRUD routes (blueprint Phase 9, PR-32). Reuses the
 * existing Persona createKnowledgeBaseSchema/updateKnowledgeBaseSchema
 * unmodified — same reasoning as the Agent/Skill Developer routes.
 *
 * Document upload/search/delete/list (blueprint Phase 9, PR-47b) reuse the
 * exact same multer memory-storage configuration as the Persona route
 * (knowledge.routes.js) — files are processed in memory and never written
 * to disk, so no additional storage-access-control surface is introduced.
 */
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 10, // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ];
    const allowedExts = /\.(pdf|txt|md|json|csv)$/i;
    const extOk = allowedExts.test(file.originalname);
    const mimeOk = allowedMimes.includes(file.mimetype);

    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type. Allowed: PDF, TXT, MD, CSV, JSON'));
  },
});

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/knowledge:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Knowledge Base (Project-owned or ExternalUser-owned)
 *     description: >
 *       Which kind gets created depends on the credential's asserted
 *       identity. providerId is REQUIRED here (unlike the Persona route,
 *       which can auto-resolve the caller's default Provider) — no
 *       equivalent "default Provider" concept exists for a Project or
 *       ExternalUser yet.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, providerId]
 *     responses:
 *       201: { description: Knowledge Base created }
 *       400: { description: "Validation error, or missing providerId" }
 */
router.post('/', validateBody(createKnowledgeBaseSchema), developerKnowledgeController.create);

/**
 * @openapi
 * /api/v1/developer/knowledge:
 *   get:
 *     tags: [Developer]
 *     summary: Discover Knowledge Bases (blueprint Phase 9, PR-45, AD-07 §19)
 *     description: >
 *       A genuinely separate code path — Knowledge has no Persona
 *       marketplace-browse feature to accidentally reuse. For a bare
 *       Project credential: every Knowledge Base in this Project's own
 *       Domain, any owner type. For a credential paired with
 *       x-persona-external-user-id: scope=mine returns only that
 *       external user's own Knowledge Bases; omitting it returns this
 *       Domain's public Knowledge Bases only.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: scope
 *         in: query
 *         schema: { type: string, enum: [mine] }
 *     responses:
 *       200: { description: List of Knowledge Bases }
 */
router.get('/', developerKnowledgeController.discover);

/**
 * @openapi
 * /api/v1/developer/knowledge/{kbId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Knowledge Base
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Knowledge Base }
 *       404: { description: Knowledge Base not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Knowledge Base (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated Knowledge Base }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Knowledge Base (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Knowledge Base deleted }
 */
router.get('/:kbId', developerKnowledgeController.getOne);
router.patch(
  '/:kbId',
  validateBody(updateKnowledgeBaseSchema),
  developerKnowledgeController.update
);
router.delete('/:kbId', developerKnowledgeController.remove);

/**
 * @openapi
 * /api/v1/developer/knowledge/{kbId}/documents:
 *   post:
 *     tags: [Developer]
 *     summary: Upload documents to a Knowledge Base (owner only, blueprint Phase 9, PR-47b)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200: { description: Documents processed }
 *       404: { description: Knowledge Base not found or unauthorized }
 *   get:
 *     tags: [Developer]
 *     summary: List a Knowledge Base's source documents (owner or public)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document list }
 *       404: { description: Knowledge Base not found or unauthorized }
 */
router.post('/:kbId/documents', upload.array('files', 10), developerKnowledgeController.upload);
router.get('/:kbId/documents', developerKnowledgeController.listDocuments);

/**
 * @openapi
 * /api/v1/developer/knowledge/{kbId}/documents/{sourceName}:
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a single document from a Knowledge Base (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: sourceName
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document deleted }
 *       404: { description: "Knowledge Base or document not found, or unauthorized" }
 */
router.delete('/:kbId/documents/:sourceName', developerKnowledgeController.deleteDocument);

/**
 * @openapi
 * /api/v1/developer/knowledge/{kbId}/search:
 *   post:
 *     tags: [Developer]
 *     summary: Semantic search within a Knowledge Base (owner or public)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string }
 *               topK: { type: integer }
 *     responses:
 *       200: { description: Search results }
 *       404: { description: Knowledge Base not found or unauthorized }
 */
router.post('/:kbId/search', developerKnowledgeController.search);

export default router;
