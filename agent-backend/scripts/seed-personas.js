/**
 * Seed creator personas + published skills (the marketplace fixtures).
 *
 *   node scripts/seed-personas.js --owner-email you@example.com [--reset]
 *
 * - The CLI owner keeps their existing persona (main agent); only their
 *   fixture skills are published and attached to it.
 * - Each other creator fixture gets a synthetic user (clerkId "seed_<slug>"),
 *   one public main agent (the persona), and its published skills attached.
 * - All seeded agents use the CLI owner's first provider.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import Provider from '../src/modules/providers/provider.model.js';
import Agent from '../src/modules/agents/agent.model.js';
import Skill from '../src/modules/skills/skill.model.js';
import Conversation from '../src/modules/threads/thread.model.js';
import startup from './fixtures/creators/startup.js';
import fitness from './fixtures/creators/fitness.js';
import o1 from './fixtures/creators/o1.js';
import systemdesign from './fixtures/creators/systemdesign.js';

const FIXTURES = [startup, fitness, o1, systemdesign];
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ownerEmail = arg('--owner-email');
const reset = process.argv.includes('--reset');
if (!ownerEmail) { console.error('Usage: node scripts/seed-personas.js --owner-email <email> [--reset]'); process.exit(1); }

async function resolveOwner(fx, cliOwner) {
  if (!fx.owner) return cliOwner;
  let user = await User.findOne({ email: fx.owner.email });
  if (!user) {
    user = await User.create({ name: fx.owner.name, email: fx.owner.email, clerkId: `seed_${fx.owner.slug}`, username: fx.owner.slug, role: 'normal' });
    console.log(`  + user ${fx.owner.email}`);
  }
  return user;
}

async function ensurePersona(owner, fx, providerId) {
  let persona = await Agent.findOne({ ownerId: owner._id, isMainAgent: true, isActive: true });
  if (persona) {
    if (persona.visibility !== 'public') { persona.visibility = 'public'; await persona.save(); console.log(`  ~ persona "${persona.name}" made public`); }
    return persona;
  }
  if (!fx.persona) throw new Error(`${owner.email} has no persona (main agent); create one in Studio first`);
  persona = await Agent.create({
    ownerId: owner._id, ownerType: 'PersonaUser', domain: 'persona',
    name: fx.persona.name, slug: fx.persona.slug, tagline: fx.persona.tagline, bio: fx.persona.bio,
    description: fx.persona.tagline, systemPrompt: fx.persona.prompt, providerId,
    webSearchEnabled: true, visibility: 'public', category: fx.persona.category || 'other',
    isMainAgent: true, avatar: fx.persona.avatar,
  });
  console.log(`  + persona "${persona.name}"`);
  return persona;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cliOwner = await User.findOne({ email: ownerEmail.toLowerCase() });
  if (!cliOwner) throw new Error(`No user with email ${ownerEmail}`);
  const provider = await Provider.findOne({ ownerId: cliOwner._id }).sort({ isDefault: -1, createdAt: 1 });
  if (!provider) throw new Error(`${ownerEmail} has no provider; add one in Settings → Providers`);
  console.log(`Owner: ${cliOwner.name} <${cliOwner.email}> · provider "${provider.label}"`);

  for (const fx of FIXTURES) {
    const owner = await resolveOwner(fx, cliOwner);
    console.log(`\n▸ ${fx.persona?.name || owner.name}`);
    if (reset && fx.persona) {
      const old = await Agent.find({ ownerId: owner._id }, '_id');
      await Conversation.deleteMany({ agentId: { $in: old.map((a) => a._id) } });
      await Agent.deleteMany({ ownerId: owner._id });
      await Skill.deleteMany({ ownerId: owner._id, name: { $in: fx.skills.map((s) => s.name) } });
      console.log('  - reset');
    }
    const persona = await ensurePersona(owner, fx, provider._id);
    const ids = [];
    for (const sk of fx.skills) {
      const doc = await Skill.findOneAndUpdate(
        { ownerId: owner._id, name: sk.name },
        { $set: { title: sk.title, hook: sk.hook, category: sk.category, description: sk.description, instructions: sk.instructions, visibility: 'public', isPublic: true, ownerType: 'PersonaUser', domain: 'persona' } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      ids.push(doc._id);
    }
    await Agent.updateOne({ _id: persona._id }, { $addToSet: { skills: { $each: ids } } });
    console.log(`  + ${ids.length} skills published and attached to "${persona.name}"`);
  }
  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
