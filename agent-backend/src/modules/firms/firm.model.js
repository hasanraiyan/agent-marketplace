import mongoose from 'mongoose';

/**
 * Firm — the one-person AI-native company a creator publishes.
 *
 * One Firm per Persona user (ownerId unique). The Firm is the marketplace
 * unit: buyers discover Firms, never individual Agents. Agents become the
 * Firm's employees by carrying `firmId` (see agent.model.js).
 */

export const FIRM_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published' });

export const FIRM_CATEGORIES = Object.freeze([
  'entrepreneurship',
  'health-fitness',
  'mind-behavior',
  'technology',
  'life-relationships',
  'careers',
  'other',
]);

const firmSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    tagline: { type: String, trim: true, maxlength: 140, default: '' },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, enum: FIRM_CATEGORIES, default: 'other', index: true },
    avatar: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    mandate: {
      takes: { type: [String], default: [] },
      refuses: { type: [String], default: [] },
      clientProfile: { type: String, default: '', maxlength: 1000 },
    },
    proof: [
      {
        quote: { type: String, required: true, maxlength: 600 },
        author: { type: String, default: '' },
        role: { type: String, default: '' },
      },
    ],
    expertise: { type: [String], default: [] },
    frontDeskAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    status: { type: String, enum: Object.values(FIRM_STATUS), default: FIRM_STATUS.DRAFT, index: true },
    publishedAt: { type: Date, default: null },
    stats: {
      projectsStarted: { type: Number, default: 0 },
      projectsCompleted: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

firmSchema.index({ status: 1, category: 1, updatedAt: -1 });

const Firm = mongoose.model('Firm', firmSchema);
export default Firm;
