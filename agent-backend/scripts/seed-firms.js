/**
 * Seed Humans & Harness fixture firms.
 *
 *   node scripts/seed-firms.js --owner-email you@example.com [--reset]
 *
 * - The Startup Firm is owned by --owner-email (an existing Persona user).
 * - The other firms get synthetic owner users (clerkId "seed_<slug>").
 * - Every agent uses the --owner-email user's first provider (API key).
 * - --reset deletes previously seeded firms (by slug) with their agents,
 *   skills, and templates before re-creating them.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import Provider from '../src/modules/providers/provider.model.js';
import Agent from '../src/modules/agents/agent.model.js';
import Skill from '../src/modules/skills/skill.model.js';
import Firm from '../src/modules/firms/firm.model.js';
import FirmProject from '../src/modules/firms/firmProject.model.js';
import ClientProject from '../src/modules/firms/clientProject.model.js';
import Conversation from '../src/modules/threads/thread.model.js';
import { slugify } from '../src/modules/firms/slugify.js';

import startup from './fixtures/firms/startup.js';
import fitness from './fixtures/firms/fitness.js';
import o1 from './fixtures/firms/o1.js';
import systemdesign from './fixtures/firms/systemdesign.js';

const FIXTURES = [startup, fitness, o1, systemdesign];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const ownerEmail = arg('--owner-email');
const reset = process.argv.includes('--reset');
if (!ownerEmail) {
  console.error('Usage: node scripts/seed-firms.js --owner-email <email> [--reset]');
  process.exit(1);
}

async function resolveOwner(fixture, cliOwner) {
  if (!fixture.owner) return cliOwner;
  const { name, email, slug } = fixture.owner;
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, clerkId: `seed_${slug}`, username: slug, role: 'normal' });
    console.log(`  + user ${email}`);
  }
  return user;
}

async function wipeFirm(slug) {
  const firm = await Firm.findOne({ slug });
  if (!firm) return;
  const agents = await Agent.find({ firmId: firm._id }, '_id');
  const agentIds = agents.map((a) => a._id);
  const projects = await ClientProject.find({ firmId: firm._id }, '_id threadId');
  await Conversation.deleteMany({
    $or: [{ firmId: firm._id }, { agentId: { $in: agentIds } }],
  });
  await ClientProject.deleteMany({ firmId: firm._id });
  await FirmProject.deleteMany({ firmId: firm._id });
  await Agent.deleteMany({ _id: { $in: agentIds } });
  await Skill.deleteMany({ ownerId: firm.ownerId, name: { $in: await seededSkillNames(firm.ownerId) } });
  await Firm.deleteOne({ _id: firm._id });
  console.log(`  - wiped firm ${slug} (${agentIds.length} agents, ${projects.length} client projects)`);
}

async function seededSkillNames(ownerId) {
  const names = new Set();
  for (const f of FIXTURES) for (const s of Object.values(f.skills)) names.add(s.name);
  return [...names];
}

async function seedFirm(fixture, cliOwner, providerId) {
  const owner = await resolveOwner(fixture, cliOwner);
  const firmSlug = slugify(fixture.firm.name);
  console.log(`\n▸ ${fixture.firm.name} (owner ${owner.email})`);

  if (reset) await wipeFirm(firmSlug);
  if (await Firm.findOne({ slug: firmSlug })) {
    console.log('  = exists, skipping (use --reset to rebuild)');
    return;
  }
  const existingForOwner = await Firm.findOne({ ownerId: owner._id });
  if (existingForOwner) {
    console.log(`  ! owner already has firm "${existingForOwner.name}" — skipping (one firm per user)`);
    return;
  }

  // Skills (upsert by owner+name)
  const skillIds = {};
  for (const [key, s] of Object.entries(fixture.skills)) {
    const doc = await Skill.findOneAndUpdate(
      { ownerId: owner._id, name: s.name },
      { $set: { description: s.description, instructions: s.instructions, isPublic: false, ownerType: 'PersonaUser', domain: 'persona' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    skillIds[key] = doc._id;
  }
  console.log(`  + ${Object.keys(skillIds).length} skills`);

  // Firm
  const firm = await Firm.create({
    ...fixture.firm,
    ownerId: owner._id,
    slug: firmSlug,
    status: 'draft',
  });

  // Employees
  const agentIds = {};
  let frontDeskId = null;
  for (const [key, e] of Object.entries(fixture.employees)) {
    const agent = await Agent.create({
      ownerId: owner._id,
      ownerType: 'PersonaUser',
      domain: 'persona',
      name: e.name,
      slug: `${firmSlug}-${key}`,
      description: e.description,
      tagline: e.title,
      systemPrompt: e.systemPrompt,
      providerId,
      webSearchEnabled: Boolean(e.webSearchEnabled),
      skills: (e.skills || []).map((k) => skillIds[k]).filter(Boolean),
      visibility: e.isFrontDesk ? 'unlisted' : 'private',
      category: 'productivity',
      isMainAgent: false,
      firmId: firm._id,
      role: { title: e.title, mandate: e.mandate, facing: e.facing },
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(e.name)}&backgroundColor=e5e7eb`,
    });
    agentIds[key] = agent._id;
    if (e.isFrontDesk) frontDeskId = agent._id;
  }
  console.log(`  + ${Object.keys(agentIds).length} employees`);

  // Project templates
  for (const p of fixture.projects) {
    await FirmProject.create({
      firmId: firm._id,
      ownerId: owner._id,
      slug: slugify(p.title),
      title: p.title,
      outcome: p.outcome,
      summary: p.summary,
      description: p.description,
      whoFor: p.whoFor,
      deliverables: p.deliverables,
      durationDays: p.durationDays,
      price: p.price,
      inputs: p.inputs,
      checkpoints: p.checkpoints,
      leadAgentId: agentIds[p.lead],
      employeeIds: (p.employees || []).map((k) => agentIds[k]).filter(Boolean),
      skillIds: (p.skills || []).map((k) => skillIds[k]).filter(Boolean),
      instructions: p.instructions,
      status: p.status || 'published',
    });
  }
  console.log(`  + ${fixture.projects.length} project templates`);

  firm.frontDeskAgentId = frontDeskId;
  firm.status = 'published';
  firm.publishedAt = new Date();
  await firm.save();
  console.log(`  ✓ published → /dashboard/firms/${firmSlug}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cliOwner = await User.findOne({ email: ownerEmail.toLowerCase() });
  if (!cliOwner) throw new Error(`No user with email ${ownerEmail}`);
  const provider = await Provider.findOne({ ownerId: cliOwner._id }).sort({ isDefault: -1, createdAt: 1 });
  if (!provider) throw new Error(`${ownerEmail} has no provider configured; add one in Settings → Providers first`);
  console.log(`Owner: ${cliOwner.name} <${cliOwner.email}> · provider "${provider.label}" (${provider.defaultModel || 'default model'})`);
  for (const fixture of FIXTURES) await seedFirm(fixture, cliOwner, provider._id);
  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
