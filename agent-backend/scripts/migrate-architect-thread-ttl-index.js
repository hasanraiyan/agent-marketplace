/**
 * One-time migration: creates the partial TTL index on Conversation
 * (thread.model.js) that auto-expires the Architect's ("Sage") own threads
 * 30 days after their last message. Purely additive — Mongoose's default
 * autoIndex would create this on the next app connect anyway, but this lets
 * it apply immediately without waiting for a restart.
 *
 * Idempotent: creating an index that already exists (same name, same
 * definition) is a no-op.
 *
 * Usage:
 *   node ./scripts/migrate-architect-thread-ttl-index.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Conversation from '../src/modules/threads/thread.model.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

export async function migrateArchitectThreadTtlIndex() {
  let indexes = [];
  try {
    indexes = await Conversation.collection.indexes();
  } catch (err) {
    // Collection doesn't exist yet (fresh DB, no Threads created) — no
    // indexes exist either, fall through to createIndexes() below, which
    // creates the collection implicitly.
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }

  const existing = indexes.find((idx) => idx.name === 'architect_thread_ttl');
  if (existing) {
    return { migrated: false, reason: 'architect_thread_ttl index already exists' };
  }

  await Conversation.createIndexes();
  return { migrated: true, reason: 'created architect_thread_ttl index' };
}

async function run() {
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await migrateArchitectThreadTtlIndex();
    console.log(result.reason);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
