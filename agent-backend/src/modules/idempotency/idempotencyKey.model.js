import mongoose from 'mongoose';

/**
 * Developer Platform (Feature 5, idempotency keys). One document per
 * `(domain, credential/externalUser, Idempotency-Key header)` tuple,
 * storing the exact response a `create()` call returned so a retried
 * request with the same key replays it instead of creating a duplicate
 * resource. `expiresAt` is a TTL index — MongoDB reaps the document once
 * it passes, no manual cleanup job needed.
 */
const idempotencyKeySchema = new mongoose.Schema(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    body: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model('IdempotencyKey', idempotencyKeySchema);
