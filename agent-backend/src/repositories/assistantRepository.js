import Assistant from '../models/Assistant.js';
import { NotFoundError } from '../utils/errors/index.js';

class AssistantRepository {
  async create(data) {
    const assistant = new Assistant(data);
    return assistant.save();
  }

  async findById(id) {
    const assistant = await Assistant.findById(id);
    if (!assistant) {
      throw new NotFoundError(`Assistant with id ${id} not found`);
    }
    return assistant;
  }

  async findByIdForOwner(id, ownerId) {
    const assistant = await Assistant.findOne({ _id: id, ownerId });
    if (!assistant) {
      throw new NotFoundError(`Assistant with id ${id} not found`);
    }
    return assistant;
  }

  async findMyAssistants(ownerId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [assistants, total] = await Promise.all([
      Assistant.find({ ownerId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Assistant.countDocuments({ ownerId }),
    ]);

    return {
      assistants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findPublicAssistants({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const filter = {
      status: 'published',
      visibility: 'public',
    };

    const [assistants, total] = await Promise.all([
      Assistant.find(filter).skip(skip).limit(limit).sort({ chatsCount: -1, createdAt: -1 }),
      Assistant.countDocuments(filter),
    ]);

    return {
      assistants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async update(id, ownerId, updateData) {
    const { _id, ownerId: _ignoredOwnerId, createdAt, ...safeUpdate } = updateData;

    const assistant = await Assistant.findOneAndUpdate(
      { _id: id, ownerId },
      { ...safeUpdate, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!assistant) {
      throw new NotFoundError(`Assistant with id ${id} not found`);
    }

    return assistant;
  }

  async findPublicById(id) {
    const assistant = await Assistant.findOne({
      _id: id,
      status: 'published',
      visibility: { $in: ['public', 'unlisted'] },
    });

    if (!assistant) {
      throw new NotFoundError(`Assistant with id ${id} not found`);
    }

    return assistant;
  }
}

const assistantRepository = new AssistantRepository();
export default assistantRepository;
