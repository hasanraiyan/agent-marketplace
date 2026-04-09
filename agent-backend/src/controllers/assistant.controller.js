import assistantRepository from '../repositories/assistantRepository.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';
import BaseError from '../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

export const createAssistant = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const data = {
      ...req.body,
      ownerId,
    };

    // Default new assistants to draft & private unless explicitly set
    if (!data.status) data.status = 'draft';
    if (!data.visibility) data.visibility = 'private';

    const assistant = await assistantRepository.create(data);

    logger.info('Assistant created', { assistantId: assistant.id, ownerId });

    res.status(201).json(
      successFormatter.formatSuccess(assistant, 'Assistant created successfully', 201)
    );
  } catch (error) {
    next(error);
  }
};

export const getMyAssistants = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const result = await assistantRepository.findMyAssistants(ownerId, {
      page,
      limit,
    });

    res.json(successFormatter.formatSuccess(result));
  } catch (error) {
    next(error);
  }
};

export const listPublicAssistants = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const result = await assistantRepository.findPublicAssistants({ page, limit });

    res.json(successFormatter.formatSuccess(result));
  } catch (error) {
    next(error);
  }
};

export const getAssistantById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    let assistant;

    if (userId) {
      try {
        assistant = await assistantRepository.findByIdForOwner(id, userId);
      } catch (err) {
        // If not owned by this user, fall back to public lookup
      }
    }

    if (!assistant) {
      assistant = await assistantRepository.findPublicById(id);
    }

    res.json(successFormatter.formatSuccess(assistant));
  } catch (error) {
    next(error);
  }
};

export const updateAssistant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    if (!Object.keys(req.body || {}).length) {
      throw new BaseError('No fields to update', 400, 'BAD_REQUEST');
    }

    const assistant = await assistantRepository.update(id, ownerId, req.body);

    logger.info('Assistant updated', { assistantId: assistant.id, ownerId });

    res.json(successFormatter.formatSuccess(assistant, 'Assistant updated successfully'));
  } catch (error) {
    next(error);
  }
};

export default {
  createAssistant,
  getMyAssistants,
  listPublicAssistants,
  getAssistantById,
  updateAssistant,
};
