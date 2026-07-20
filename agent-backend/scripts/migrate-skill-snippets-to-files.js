/**
 * One-time migration: legacy Skill.codeSnippets → Skill.files.
 *
 * Converts each { filename, code } snippet to { path, content, mimeType }.
 * Skips skills that already have files[] entries (idempotent) and unsets
 * codeSnippets after a successful conversion.
 *
 * Usage: node ./scripts/migrate-skill-snippets-to-files.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Skill from '../src/modules/skills/skill.model.js';
import { normalizeSkillFilePath, mimeTypeForSkillPath } from '../src/utils/skillValidation.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

async function run() {
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  const skills = await Skill.find({ 'codeSnippets.0': { $exists: true } });
  let migrated = 0;
  let skipped = 0;

  for (const skill of skills) {
    if (skill.files?.length > 0) {
      skipped += 1;
      continue;
    }

    const files = [];
    const seen = new Set();
    for (const snippet of skill.codeSnippets || []) {
      const path = normalizeSkillFilePath(snippet.filename);
      if (!path || path.toUpperCase() === 'SKILL.MD' || seen.has(path)) {
        console.warn(`  [${skill.name}] skipping unusable snippet filename: ${snippet.filename}`);
        continue;
      }
      seen.add(path);
      files.push({
        path,
        content: String(snippet.code ?? ''),
        mimeType: mimeTypeForSkillPath(path),
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      });
    }

    await Skill.updateOne(
      { _id: skill._id },
      { $set: { files }, $unset: { codeSnippets: 1 } },
      { timestamps: false }
    );
    migrated += 1;
    console.log(`  migrated ${skill.name}: ${files.length} file(s)`);
  }

  console.log(`Done. Migrated ${migrated} skill(s), skipped ${skipped} already-converted.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
