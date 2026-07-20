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

// CRUD
router.post('/', validateBody(createKnowledgeBaseSchema), knowledgeController.create);
router.get('/', knowledgeController.list);
router.get('/:id', knowledgeController.getOne);
router.patch('/:id', validateBody(updateKnowledgeBaseSchema), knowledgeController.update);
router.delete('/:id', knowledgeController.remove);

// File upload (multipart)
router.post('/:id/upload', upload.array('files', 10), knowledgeController.upload);

// Documents & Search
router.get('/:id/documents', knowledgeController.listDocuments);
router.delete('/:id/documents/:sourceName', knowledgeController.deleteDocument);
router.post('/:id/search', validateBody(searchKnowledgeBaseSchema), knowledgeController.search);

export default router;
