import mongoose from 'mongoose';

const providerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    baseURL: {
      type: String,
      required: true,
      trim: true,
    },
    apiKeyEncrypted: {
      type: String,
      required: true,
    },
    defaultModel: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Provider = mongoose.model('Provider', providerSchema);

export default Provider;
