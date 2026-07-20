import mongoose from 'mongoose';

const knowledgeChunkSchema = new mongoose.Schema(
  {
    kbId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeBase',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Qdrant point ID for cross-reference
    qdrantPointId: {
      type: String,
      default: null,
    },
    metadata: {
      sourceName: { type: String, required: true },
      chunkIndex: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ kbId: 1, 'metadata.sourceName': 1 });

const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);

export default KnowledgeChunk;
