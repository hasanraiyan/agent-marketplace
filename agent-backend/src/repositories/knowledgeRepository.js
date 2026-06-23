import KnowledgeBase from '../models/KnowledgeBase.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';

class KnowledgeRepository {
  // ── Knowledge Base ────────────────────────────────────────────────

  async createKb(data) {
    const kb = new KnowledgeBase(data);
    return await kb.save();
  }

  async findKbById(id) {
    return await KnowledgeBase.findById(id);
  }

  async findKbsByUser(userId) {
    return await KnowledgeBase.find({ ownerId: userId }).sort({ updatedAt: -1 });
  }

  async updateKb(id, updateData) {
    return await KnowledgeBase.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async deleteKb(id) {
    return await KnowledgeBase.findByIdAndDelete(id);
  }

  async findKbsByIds(ids) {
    return await KnowledgeBase.find({ _id: { $in: ids } });
  }

  // ── Chunks ────────────────────────────────────────────────────────

  async insertChunks(chunks) {
    return await KnowledgeChunk.insertMany(chunks, { ordered: false });
  }

  async findChunksByKbId(kbId) {
    return await KnowledgeChunk.find({ kbId }).sort({ 'metadata.chunkIndex': 1 });
  }

  async findChunksBySource(kbId, sourceName) {
    return await KnowledgeChunk.find({ kbId, 'metadata.sourceName': sourceName }).sort({
      'metadata.chunkIndex': 1,
    });
  }

  async countChunksByKbId(kbId) {
    return await KnowledgeChunk.countDocuments({ kbId });
  }

  async deleteChunksByKbId(kbId) {
    return await KnowledgeChunk.deleteMany({ kbId });
  }

  async getDocumentList(kbId) {
    return await KnowledgeChunk.distinct('metadata.sourceName', { kbId });
  }

  async deleteChunksBySource(kbId, sourceName) {
    return await KnowledgeChunk.deleteMany({ kbId, 'metadata.sourceName': sourceName });
  }
}

export default new KnowledgeRepository();
