import knowledgeService from '../services/knowledge.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

class KnowledgeController {
  /**
   * POST /api/v1/knowledge — Create a new Knowledge Base
   */
  async create(req, res, next) {
    try {
      const {
        name,
        description,
        isPublic,
        embeddingModel,
        providerId,
        chunkSize,
        chunkOverlap,
        topK,
      } = req.body;
      const kb = await knowledgeService.createKnowledgeBase(req.user.id, {
        name,
        description,
        isPublic,
        embeddingModel,
        providerId,
        chunkSize,
        chunkOverlap,
        topK,
      });

      res.status(201).json({
        success: true,
        data: kb,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/knowledge — List user's knowledge bases
   */
  async list(req, res, next) {
    try {
      const kbs = await knowledgeService.listKnowledgeBases(req.user.id);

      res.json({
        success: true,
        data: kbs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/knowledge/:id — Get a single knowledge base
   */
  async getOne(req, res, next) {
    try {
      const kb = await knowledgeService.getKnowledgeBase(req.params.id, req.user.id);

      res.json({
        success: true,
        data: kb,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized to access this knowledge base') {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/v1/knowledge/:id — Update a knowledge base
   */
  async update(req, res, next) {
    try {
      const kb = await knowledgeService.updateKnowledgeBase(req.params.id, req.user.id, req.body);

      res.json({
        success: true,
        data: kb,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized to update this knowledge base') {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.message === 'No valid fields to update') {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/v1/knowledge/:id — Delete a knowledge base
   */
  async remove(req, res, next) {
    try {
      await knowledgeService.deleteKnowledgeBase(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Knowledge base deleted successfully',
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized to delete this knowledge base') {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/knowledge/:id/upload — Upload files to a knowledge base
   * Expects multipart/form-data with field name "files" (up to 10 files)
   */
  async upload(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded. Please select at least one file.',
        });
      }

      const result = await knowledgeService.uploadFiles(req.params.id, req.user.id, req.files);

      res.json({
        success: true,
        data: result,
        message: `${result.files.length} file(s) processed successfully`,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized to upload to this knowledge base') {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/v1/knowledge/:id/documents/:sourceName — Delete a single document
   */
  async deleteDocument(req, res, next) {
    try {
      const sourceName = decodeURIComponent(req.params.sourceName);
      const result = await knowledgeService.deleteDocumentFromKb(
        req.params.id,
        req.user.id,
        sourceName
      );

      res.json({
        success: true,
        data: result,
        message: `Document deleted. ${result.removedChunks} chunk(s) removed.`,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized to modify this knowledge base') {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.message?.startsWith('Document')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/knowledge/:id/documents — List source documents in a KB
   */
  async listDocuments(req, res, next) {
    try {
      const documents = await knowledgeService.listDocumentSources(req.params.id, req.user.id);

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Not authorized') {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/knowledge/:id/search — Search within a knowledge base
   */
  async search(req, res, next) {
    try {
      const { query, topK } = req.body;
      const results = await knowledgeService.searchKnowledgeBase(req.params.id, query, { topK });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

export default new KnowledgeController();
