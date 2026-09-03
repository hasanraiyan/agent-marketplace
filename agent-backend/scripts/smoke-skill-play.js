/** Play a published skill through a persona: one turn, pinned-skill context, no HTTP. */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import '../src/modules/stores/store.model.js';
import '../src/modules/mcp/mcp.model.js';
import '../src/modules/mcp/mcp-user-connection.model.js';
import '../src/modules/knowledge/knowledge-base.model.js';
import '../src/modules/restApiTools/restApiTool.model.js';
import Agent from '../src/modules/agents/agent.model.js';
import Skill from '../src/modules/skills/skill.model.js';
import threadRepository from '../src/modules/threads/thread.repository.js';
import skillService from '../src/modules/skills/skill.service.js';
import { runAgentAsAguiEvents } from '../src/modules/agui/agui.service.js';

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const email = arg('--client-email');
const skillName = arg('--skill', 'pitch-narrative-rubric');
const message = arg('--message', 'Here is my opening: "We are building an AI-powered platform that revolutionizes how experts monetize knowledge." Score it.');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const client = await User.findOne({ email: email.toLowerCase() });
  const skill = await Skill.findOne({ name: skillName, visibility: 'public' });
  if (!skill) throw new Error('skill not found/public');
  const personas = await skillService.resolvePersonas([skill.ownerId]);
  const persona = personas[String(skill.ownerId)];
  if (!persona) throw new Error('no persona for owner');
  const agent = await Agent.findById(persona._id);
  const pinned = await skillService.getPinnedSkillForAgent(skill._id, agent);
  if (!pinned) throw new Error('pin rejected');
  console.log(`✓ skill "${pinned.title}" → persona "${agent.name}" (${agent._id})`);
  const thread = await threadRepository.create({ agentId: agent._id, userId: client._id, threadId: crypto.randomUUID(), title: pinned.title, skillId: pinned._id });
  const block = `### PINNED SKILL: ${pinned.title || pinned.name}\n${pinned.hook ? pinned.hook + '\n' : ''}The visitor came here to use this specific skill of yours. Apply it deliberately in this conversation; if the request drifts outside it, say what the skill covers and still help.\n\n${pinned.instructions}`;
  let text = ''; const tools = [];
  const t0 = Date.now();
  for await (const ev of runAgentAsAguiEvents({ agentId: String(agent._id), userId: client._id, langGraphThreadId: thread.threadId, threadDbId: thread._id, messages: [{ id: 'm1', role: 'user', content: message }], contextOverride: block })) {
    if (ev.type === 'TEXT_MESSAGE_CONTENT') text += ev.delta || '';
    else if (ev.type === 'TOOL_CALL_START') tools.push(ev.toolCallName);
    else if (ev.type === 'RUN_ERROR') console.error('RUN_ERROR', ev.message);
  }
  console.log(`--- ${((Date.now() - t0) / 1000).toFixed(1)}s · tools: ${tools.join(', ') || 'none'} ---\n${text.slice(0, 1800)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
