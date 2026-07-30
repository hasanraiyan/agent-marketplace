/**
 * One-time migration (Developer Platform PR-33, blueprint Phase 9): the
 * Mcp collection's `(ownerId, name)` unique index predates `ownerId`
 * becoming conditionally required (PR-33) — it was created without a
 * `partialFilterExpression`, back when `ownerId` was unconditionally
 * required. Identical rationale and mechanics to
 * migrate-skill-ownership-index.js (PR-27) — see that script for the full
 * explanation of why Mongoose's `autoIndex` can't fix this on its own.
 *
 * Idempotent: dropping a nonexistent index is a no-op (caught and
 * ignored); creating an index Mongoose has already created for this
 * schema is also a no-op.
 *
 * Usage:
 *   node ./scripts/migrate-mcp-ownership-index.js --dry-run   (report only)
 *   node ./scripts/migrate-mcp-ownership-index.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Mcp from '../src/modules/mcp/mcp.model.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

export async function migrateMcpOwnershipIndex({ dryRun = false } = {}) {
  const indexes = await Mcp.collection.indexes();
  const staleIndex = indexes.find(
    (idx) => idx.name === 'ownerId_1_name_1' && !idx.partialFilterExpression && idx.unique === true
  );

  if (!staleIndex) {
    return { migrated: false, reason: 'no stale non-partial index found (already migrated)' };
  }

  if (dryRun) {
    return { migrated: false, reason: 'dry-run — would drop and recreate ownerId_1_name_1' };
  }

  await Mcp.collection.dropIndex('ownerId_1_name_1');
  await Mcp.createIndexes();

  return { migrated: true, reason: 'dropped stale index, recreated with partialFilterExpression' };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await migrateMcpOwnershipIndex({ dryRun });
    console.log(dryRun ? `[dry-run] ${result.reason}` : result.reason);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
