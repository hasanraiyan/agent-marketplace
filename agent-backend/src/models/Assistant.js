import mongoose from 'mongoose';

const assistantSchema = new mongoose.Schema(
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
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    systemPrompt: {
      type: String,
      trim: true,
      maxlength: 8000,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    chatsCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

assistantSchema.index({ ownerId: 1, createdAt: -1 });
assistantSchema.index({ status: 1, visibility: 1 });

const Assistant = mongoose.model('Assistant', assistantSchema);

export default Assistant;
