/**
 * One-time migration (Developer Platform PR-12, blueprint Phase 4): materializes
 * `domain`/`ownerType` on Skill, KnowledgeBase, Mcp, and Provider documents that
 * predate those fields (added in PR-11). Every document created before this
 * migration is Persona-owned, so this only ever writes domain: 'persona',
 * ownerType: 'PersonaUser' — exactly the schema defaults new documents already
 * receive automatically going forward. Same shape as PR-9's
 * backfill-agent-domain-fields.js, generalized across the four models.
 *
 * Idempotent: only targets documents missing either field ($exists: false), so
 * re-running it after a successful run is a safe no-op.
 *
 * Usage:
 *   node ./scripts/backfill-resource-domain-fields.js --dry-run   (report only)
 *   node ./scripts/backfill-resource-domain-fields.js             (write)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Skill from '../src/modules/skills/skill.model.js';
import KnowledgeBase from '../src/modules/knowledge/knowledge-base.model.js';
import Mcp from '../src/modules/mcp/mcp.model.js';
import Provider from '../src/modules/providers/provider.model.js';
import { PERSONA_DOMAIN } from '../src/modules/auth/personaPrincipalContext.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

const MISSING_FIELD_FILTER = {
  $or: [{ domain: { $exists: false } }, { ownerType: { $exists: false } }],
};

const TARGETS = [
  { label: 'Skill', Model: Skill },
  { label: 'KnowledgeBase', Model: KnowledgeBase },
  { label: 'Mcp', Model: Mcp },
  { label: 'Provider', Model: Provider },
];

export async function backfillResourceDomainFields({ dryRun = false } = {}) {
  const results = {};

  for (const { label, Model } of TARGETS) {
    const matched = await Model.countDocuments(MISSING_FIELD_FILTER);

    if (dryRun || matched === 0) {
      results[label] = { matched, modified: 0, dryRun: Boolean(dryRun) };
      continue;
    }

    const result = await Model.updateMany(MISSING_FIELD_FILTER, {
      $set: { domain: PERSONA_DOMAIN, ownerType: 'PersonaUser' },
    });

    results[label] = { matched, modified: result.modifiedCount, dryRun: false };
  }

  return results;
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    const results = await backfillResourceDomainFields({ dryRun });
    for (const [label, result] of Object.entries(results)) {
      console.log(
        dryRun
          ? `[dry-run] ${label}: ${result.matched} document(s) would be backfilled.`
          : `${label}: backfilled ${result.modified} of ${result.matched} matched document(s).`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
});
