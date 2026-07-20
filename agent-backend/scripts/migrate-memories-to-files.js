/**
 * One-time migration: legacy key-value memory → file-based memory.
 *
 *   1. user.profile.summary + preferences  → /index.md + /preferences.md
 *      under namespace ['users', <userId>]
 *   2. agent_memories KV docs (namespace [agentId]) → /learnings.md
 *      under namespace ['users', <ownerId>, 'agents', <agentId>]
 *      (attributed to the agent's owner: KV entries had no user attribution)
 *
 * Idempotent: skips targets that already exist; leaves source data in place.
 *
 * Usage: node ./scripts/migrate-memories-to-files.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import Agent from '../src/modules/agents/agent.model.js';
import MemoryFile from '../src/modules/memory/memory-file.model.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace';

async function upsertIfMissing(namespace, key, content) {
  const existing = await MemoryFile.findOne({ namespace, key });
  if (existing) return false;
  await MemoryFile.create({ namespace, key, content, mimeType: 'text/markdown' });
  return true;
}

function prefsToObject(preferences) {
  const prefs = {};
  if (preferences instanceof Map) {
    for (const [k, v] of preferences.entries()) prefs[k] = v;
  } else if (preferences && typeof preferences === 'object') {
    Object.assign(prefs, preferences);
  }
  return prefs;
}

function valueToMarkdown(value) {
  if (typeof value === 'string') return value;
  try {
    return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
  } catch {
    return String(value);
  }
}

async function migrateUserProfiles() {
  let migrated = 0;
  const users = await User.find({}, '_id profile');

  for (const user of users) {
    const userId = String(user._id);
    const namespace = ['users', userId];
    const summary = user.profile?.summary || '';
    const prefs = prefsToObject(user.profile?.preferences);
    const prefKeys = Object.keys(prefs);

    if (!summary && prefKeys.length === 0) continue;

    const indexLines = ['# Memory Index', ''];
    if (summary) indexLines.push(summary, '');
    if (prefKeys.length > 0) {
      indexLines.push('- Saved preferences → /memories/user/preferences.md');
    }
    const wroteIndex = await upsertIfMissing(namespace, '/index.md', indexLines.join('\n') + '\n');

    let wrotePrefs = false;
    if (prefKeys.length > 0) {
      const prefLines = ['# Preferences', ''];
      for (const key of prefKeys) prefLines.push(`- ${key}: ${prefs[key]}`);
      wrotePrefs = await upsertIfMissing(namespace, '/preferences.md', prefLines.join('\n') + '\n');
    }

    if (wroteIndex || wrotePrefs) migrated++;
  }

  console.log(`User profiles migrated: ${migrated}/${users.length}`);
}

async function migrateAgentMemories() {
  const coll = mongoose.connection.db.collection('agent_memories');
  const docs = await coll.find({}).sort({ updatedAt: 1 }).toArray();

  // Group KV entries by agent id (legacy namespace was [agentId] or 'agentId').
  const byAgent = new Map();
  for (const doc of docs) {
    const ns = Array.isArray(doc.namespace) ? doc.namespace[0] : doc.namespace;
    if (!ns || !mongoose.Types.ObjectId.isValid(ns)) continue;
    if (!byAgent.has(ns)) byAgent.set(ns, []);
    byAgent.get(ns).push(doc);
  }

  let migrated = 0;
  for (const [agentId, entries] of byAgent.entries()) {
    const agent = await Agent.findById(agentId, '_id ownerId name');
    if (!agent?.ownerId) continue;

    const namespace = ['users', String(agent.ownerId), 'agents', agentId];
    const lines = ['# Agent Learnings', ''];
    for (const entry of entries) {
      lines.push(`## ${entry.key}`, '', valueToMarkdown(entry.value), '');
    }

    const wroteLearnings = await upsertIfMissing(namespace, '/learnings.md', lines.join('\n'));
    const wroteIndex = await upsertIfMissing(
      namespace,
      '/index.md',
      `# Memory Index\n\n- Migrated learnings (${entries.length}) → /memories/agent/learnings.md\n`
    );
    if (wroteLearnings || wroteIndex) migrated++;
  }

  console.log(`Agent memory groups migrated: ${migrated}/${byAgent.size}`);
}

async function run() {
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  try {
    await migrateUserProfiles();
    await migrateAgentMemories();
    console.log('Migration complete.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
