import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    documentCount: {
      type: Number,
      default: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    qdrantCollectionName: {
      type: String,
      required: true,
      unique: true,
    },
    documents: [
      {
        fileName: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        mimeType: { type: String, default: '' },
        chunkCount: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    embeddingModel: {
      type: String,
      default: 'text-embedding-3-small',
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: false,
      index: true,
    },
    chunkSize: {
      type: Number,
      default: 800,
    },
    chunkOverlap: {
      type: Number,
      default: 100,
    },
    topK: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);

export default KnowledgeBase;
