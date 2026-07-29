/**
 * One-time migration (Developer Platform PR-9, blueprint Phase 3): materializes
 * `domain`/`ownerType` on Agent documents that predate those fields (added in
 * PR-8, agent.model.js). Every Agent created before this migration is a
 * Persona-owned agent, so this only ever writes domain: 'persona',
 * ownerType: 'PersonaUser' — exactly the schema defaults new documents
 * already receive automatically going forward.
 *
 * Idempotent: only targets documents missing either field ($exists: false),
 * so re-running it after a successful run is a safe no-op.
 *
 * Usage:
 *   node ./scripts/backfill-agent-domain-fields.js --dry-run   (report only)
 *   node ./scripts/backfill-agent-domain-fields.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Agent from '../src/modules/agents/agent.model.js';
import { PERSONA_DOMAIN } from '../src/modules/auth/personaPrincipalContext.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

const MISSING_FIELD_FILTER = {
  $or: [{ domain: { $exists: false } }, { ownerType: { $exists: false } }],
};

export async function backfillAgentDomainFields({ dryRun = false } = {}) {
  const matched = await Agent.countDocuments(MISSING_FIELD_FILTER);

  if (dryRun || matched === 0) {
    return { matched, modified: 0, dryRun: Boolean(dryRun) };
  }

  const result = await Agent.updateMany(MISSING_FIELD_FILTER, {
    $set: { domain: PERSONA_DOMAIN, ownerType: 'PersonaUser' },
  });

  return { matched, modified: result.modifiedCount, dryRun: false };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const result = await backfillAgentDomainFields({ dryRun });
    console.log(
      dryRun
        ? `[dry-run] ${result.matched} Agent document(s) would be backfilled.`
        : `Backfilled ${result.modified} of ${result.matched} matched Agent document(s).`
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
});
