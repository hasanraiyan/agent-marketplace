import express from 'express';
import multer from 'multer';
import authMiddleware from '../auth/auth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  searchKnowledgeBaseSchema,
} from './knowledge.validator.js';
import knowledgeController from './knowledge.controller.js';
import BaseError from '../../utils/errors/BaseError.js';

const router = express.Router();

// Configure multer for knowledge file uploads (memory storage — we don't
// write to disk, just process the buffer and discard)
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
      cb(null, true);
    } else {
      cb(
        new BaseError(
          'Unsupported file type. Allowed: PDF, TXT, MD, JSON, CSV',
          400,
          'BAD_REQUEST'
        ),
        false
      );
    }
  },
});

// All knowledge routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/v1/knowledge:
 *   get:
 *     tags: [Knowledge]
 *     summary: List knowledge bases
 *     description: Returns all knowledge bases owned by the authenticated user.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Knowledge base list with document and chunk counts
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Knowledge]
 *     summary: Create a knowledge base
 *     description: Creates an empty knowledge base that documents can be uploaded into. Knowledge bases are used for RAG (Retrieval-Augmented Generation).
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Knowledge base name
 *               description:
 *                 type: string
 *                 description: Description of what this knowledge base contains
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the knowledge base is publicly accessible
 *     responses:
 *       201:
 *         description: Knowledge base created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', validateBody(createKnowledgeBaseSchema), knowledgeController.create);
router.get('/', knowledgeController.list);

/**
 * @openapi
 * /api/v1/knowledge/{id}:
 *   get:
 *     tags: [Knowledge]
 *     summary: Get knowledge base details
 *     description: Returns knowledge base metadata including document and chunk counts.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *   patch:
 *     tags: [Knowledge]
 *     summary: Update knowledge base
 *     description: Updates knowledge base metadata (name, description, visibility).
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Knowledge base updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *   delete:
 *     tags: [Knowledge]
 *     summary: Delete knowledge base
 *     description: Permanently deletes the knowledge base and all its documents and vector embeddings from Qdrant.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base and all documents deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */
router.get('/:id', knowledgeController.getOne);
router.patch('/:id', validateBody(updateKnowledgeBaseSchema), knowledgeController.update);
router.delete('/:id', knowledgeController.remove);

/**
 * @openapi
 * /api/v1/knowledge/{id}/upload:
 *   post:
 *     tags: [Knowledge]
 *     summary: Upload documents to a knowledge base
 *     description: >
 *       Uploads one or more documents to be ingested into the knowledge base.
 *       Files are processed in memory (multer memoryStorage), chunked via
 *       RecursiveCharacterTextSplitter, embedded via OpenAI embeddings, and
 *       stored in Qdrant vector database for semantic search.
 *       Supported formats: PDF, TXT, MD, JSON, CSV (max 20MB each, max 10 files).
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload (PDF, TXT, MD, JSON, CSV)
 *     responses:
 *       200:
 *         description: Upload successful — returns document names and chunk counts
 *       400:
 *         description: Invalid file type, too many files, or file too large
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */
router.post('/:id/upload', upload.array('files', 10), knowledgeController.upload);

/**
 * @openapi
 * /api/v1/knowledge/{id}/documents:
 *   get:
 *     tags: [Knowledge]
 *     summary: List documents in a knowledge base
 *     description: Returns metadata for all documents stored in a knowledge base.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Document list with names, sizes, and chunk counts
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */
router.get('/:id/documents', knowledgeController.listDocuments);

/**
 * @openapi
 * /api/v1/knowledge/{id}/documents/{sourceName}:
 *   delete:
 *     tags: [Knowledge]
 *     summary: Delete a document from a knowledge base
 *     description: Removes a specific document from the knowledge base and deletes its vector embeddings from Qdrant.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *       - name: sourceName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Document filename (sourceName) to delete
 *     responses:
 *       200:
 *         description: Document and its embeddings deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base or document not found
 */
router.delete('/:id/documents/:sourceName', knowledgeController.deleteDocument);

/**
 * @openapi
 * /api/v1/knowledge/{id}/search:
 *   post:
 *     tags: [Knowledge]
 *     summary: Search a knowledge base
 *     description: >
 *       Performs semantic search across all documents in a knowledge base.
 *       Queries are embedded via OpenAI embeddings and matched against the
 *       Qdrant vector index. Returns relevant chunks with source attribution.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language search query
 *               topK:
 *                 type: integer
 *                 default: 5
 *                 description: Number of top results to return
 *     responses:
 *       200:
 *         description: Search results with matching chunks and source attribution
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */
router.post('/:id/search', validateBody(searchKnowledgeBaseSchema), knowledgeController.search);

export default router;
