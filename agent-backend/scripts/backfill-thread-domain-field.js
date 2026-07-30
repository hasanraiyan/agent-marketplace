/**
 * One-time migration (Developer Platform PR-14, blueprint Phase 6): materializes
 * `domain` on Thread/Conversation documents that predate that field (added in
 * PR-13, thread.model.js). Every Thread created before this migration belongs
 * to Persona, so this only ever writes domain: 'persona' — exactly the schema
 * default new documents already receive automatically going forward. Same
 * shape as PR-9's backfill-agent-domain-fields.js, single-field.
 *
 * Idempotent: only targets documents missing the field ($exists: false), so
 * re-running it after a successful run is a safe no-op.
 *
 * Usage:
 *   node ./scripts/backfill-thread-domain-field.js --dry-run   (report only)
 *   node ./scripts/backfill-thread-domain-field.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Conversation from '../src/modules/threads/thread.model.js';
import { PERSONA_DOMAIN } from '../src/modules/auth/personaPrincipalContext.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

const MISSING_FIELD_FILTER = { domain: { $exists: false } };

export async function backfillThreadDomainField({ dryRun = false } = {}) {
  const matched = await Conversation.countDocuments(MISSING_FIELD_FILTER);

  if (dryRun || matched === 0) {
    return { matched, modified: 0, dryRun: Boolean(dryRun) };
  }

  const result = await Conversation.updateMany(MISSING_FIELD_FILTER, {
    $set: { domain: PERSONA_DOMAIN },
  });

  return { matched, modified: result.modifiedCount, dryRun: false };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await backfillThreadDomainField({ dryRun });
    console.log(
      dryRun
        ? `[dry-run] ${result.matched} Thread document(s) would be backfilled.`
        : `Backfilled ${result.modified} of ${result.matched} matched Thread document(s).`
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
});
