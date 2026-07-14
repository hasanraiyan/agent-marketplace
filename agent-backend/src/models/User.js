import mongoose from 'mongoose';
import { z } from 'zod';

export const UserRole = z.enum(['normal', 'admin']);

export const userSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  username: z.string().min(2).max(50).optional(),
  age: z.number().int().min(0).max(150).optional(),
  isActive: z.boolean().default(true),
  role: UserRole.default('normal'),
  profile: z
    .object({
      preferences: z.record(z.string()).default({}),
      summary: z.string().default(''),
      lastUpdated: z.date().default(() => new Date()),
    })
    .optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

/**
 * Mongoose schema for User
 */
const userMongooseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['normal', 'admin'],
      default: 'normal',
    },
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    profile: {
      preferences: {
        type: Map,
        of: String,
        default: new Map(),
      },
      summary: {
        type: String,
        default: '',
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
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

// Create indexes
userMongooseSchema.index({ isActive: 1 });
userMongooseSchema.index({ createdAt: -1 });
userMongooseSchema.index({ role: 1 });

/**
 * User model
 */
const User = mongoose.model('User', userMongooseSchema);

export default User;
