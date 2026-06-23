import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    avatar: {
      type: String,
      default: function () {
        // Default to a DiceBear bot avatar based on the name if no avatar provided
        return `https://res.cloudinary.com/djkpavwmp/image/upload/v1777255297/portfolio_assets/q3kcklesxkonvin1ocpi.png`;
      },
    },
    tags: [
      {
        type: String,
      },
    ],
    systemPrompt: {
      type: String,
      required: true,
      minlength: 10,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    modelName: {
      type: String,
      default: '',
    },
    webSearchEnabled: {
      type: Boolean,
      default: false,
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],
    mcps: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mcp',
      },
    ],
    knowledgeBases: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeBase',
      },
    ],
    interruptOn: {
      type: Map,
      of: Boolean,
      default: {
        write_file: false,
        edit_file: false,
        delete_file: false,
      },
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
      index: true,
    },
    category: {
      type: String,
      enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'],
      default: 'other',
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure even existing agents without an avatar get a default one when retrieved
agentSchema.virtual('avatarUrl').get(function () {
  if (this.avatar && this.avatar.trim() !== '') {
    return this.avatar;
  }
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.name || 'agent')}`;
});

const Agent = mongoose.model('Agent', agentSchema);

export default Agent;
