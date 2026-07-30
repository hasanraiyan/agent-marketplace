/**
 * One-time migration (Developer Platform PR-47c, blueprint Phase 9): the
 * McpUserConnection collection's `(mcpId, userId)` unique index predates
 * `userId` becoming conditionally required — it was created without a
 * `partialFilterExpression`, back when `userId` was unconditionally
 * required. Identical rationale and mechanics to
 * migrate-skill-ownership-index.js (PR-27) / migrate-mcp-ownership-index.js
 * (PR-33) — see those scripts for the full explanation of why Mongoose's
 * `autoIndex` can't fix this on its own.
 *
 * Idempotent: dropping a nonexistent index is a no-op (caught and
 * ignored); creating an index Mongoose has already created for this
 * schema is also a no-op.
 *
 * Usage:
 *   node ./scripts/migrate-mcp-user-connection-index.js --dry-run   (report only)
 *   node ./scripts/migrate-mcp-user-connection-index.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import McpUserConnection from '../src/modules/mcp/mcp-user-connection.model.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

export async function migrateMcpUserConnectionIndex({ dryRun = false } = {}) {
  const indexes = await McpUserConnection.collection.indexes();
  const staleIndex = indexes.find(
    (idx) => idx.name === 'mcpId_1_userId_1' && !idx.partialFilterExpression && idx.unique === true
  );

  if (!staleIndex) {
    return { migrated: false, reason: 'no stale non-partial index found (already migrated)' };
  }

  if (dryRun) {
    return { migrated: false, reason: 'dry-run — would drop and recreate mcpId_1_userId_1' };
  }

  await McpUserConnection.collection.dropIndex('mcpId_1_userId_1');
  await McpUserConnection.createIndexes();

  return { migrated: true, reason: 'dropped stale index, recreated with partialFilterExpression' };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await migrateMcpUserConnectionIndex({ dryRun });
    console.log(dryRun ? `[dry-run] ${result.reason}` : result.reason);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
