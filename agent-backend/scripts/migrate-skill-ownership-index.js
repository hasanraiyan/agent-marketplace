/**
 * One-time migration (Developer Platform PR-27, blueprint Phase 9): the
 * Skill collection's `(ownerId, name)` unique index predates
 * `ownerId` becoming conditionally required (PR-27) — it was created
 * without a `partialFilterExpression`, back when `ownerId` was
 * unconditionally required. Mongoose's `autoIndex` only ever ADDS indexes
 * missing from the schema; it never drops or recreates an existing index
 * whose key pattern already matches but whose *options* have changed. So
 * every environment that already has this index (any dev/prod DB that
 * predates PR-27) keeps the old, non-partial version forever unless
 * explicitly migrated — and the old version silently breaks the very
 * first time two different Project- or ExternalUser-owned Skills
 * (`ownerId` absent on both) share a `name`, since a non-partial unique
 * index treats a missing field as `null` and rejects the second insert as
 * a duplicate key on `{ ownerId: null, name: ... }`.
 *
 * Idempotent: dropping a nonexistent index is a no-op (caught and
 * ignored); creating an index Mongoose has already created for this
 * schema is also a no-op.
 *
 * Usage:
 *   node ./scripts/migrate-skill-ownership-index.js --dry-run   (report only)
 *   node ./scripts/migrate-skill-ownership-index.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Skill from '../src/modules/skills/skill.model.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

export async function migrateSkillOwnershipIndex({ dryRun = false } = {}) {
  const indexes = await Skill.collection.indexes();
  const staleIndex = indexes.find(
    (idx) => idx.name === 'ownerId_1_name_1' && !idx.partialFilterExpression && idx.unique === true
  );

  if (!staleIndex) {
    return { migrated: false, reason: 'no stale non-partial index found (already migrated)' };
  }

  if (dryRun) {
    return { migrated: false, reason: 'dry-run — would drop and recreate ownerId_1_name_1' };
  }

  await Skill.collection.dropIndex('ownerId_1_name_1');
  await Skill.createIndexes();

  return { migrated: true, reason: 'dropped stale index, recreated with partialFilterExpression' };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await migrateSkillOwnershipIndex({ dryRun });
    console.log(dryRun ? `[dry-run] ${result.reason}` : result.reason);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
