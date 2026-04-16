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
      default: '',
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
      }
    ],
    interruptOn: {
      type: Map,
      of: Boolean,
      default: {
        'write_file': true,
        'edit_file': true,
        'delete_file': true
      }
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
  },
  { timestamps: true }
);

const Agent = mongoose.model('Agent', agentSchema);

export default Agent;
