/**
 * Simulation harness: run creator/client sessions through the same runtime
 * the UI uses (runAgentAsAguiEvents), with a simulated human driven by an LLM.
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { ChatOpenAI } from '@langchain/openai';
import User from '../../src/modules/users/user.model.js';
import Provider from '../../src/modules/providers/provider.model.js';
import Agent from '../../src/modules/agents/agent.model.js';
import Skill from '../../src/modules/skills/skill.model.js';
import '../../src/modules/stores/store.model.js';
import '../../src/modules/mcp/mcp.model.js';
import '../../src/modules/mcp/mcp-user-connection.model.js';
import '../../src/modules/knowledge/knowledge-base.model.js';
import '../../src/modules/restApiTools/restApiTool.model.js';
import threadRepository from '../../src/modules/threads/thread.repository.js';
import { runAgentAsAguiEvents } from '../../src/modules/agui/agui.service.js';
import { ARCHITECT_AGENT_ID } from '../../src/modules/agents/architectConstants.js';
import encryption from '../../src/utils/encryption.js';

export { ARCHITECT_AGENT_ID };

export async function connect() {
  await mongoose.connect(process.env.MONGODB_URI);
}

/** Ensure a synthetic user with a provider cloned from the owner's. */
export async function ensureCreator({ name, email, slug }, ownerEmail) {
  const owner = await User.findOne({ email: ownerEmail.toLowerCase() });
  if (!owner) throw new Error(`owner ${ownerEmail} not found`);
  const src = await Provider.findOne({ ownerId: owner._id }).sort({ isDefault: -1, createdAt: 1 });
  if (!src) throw new Error('owner has no provider');
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ name, email, clerkId: `sim_${slug}`, username: slug, role: 'normal' });
  let provider = await Provider.findOne({ ownerId: user._id });
  if (!provider) {
    provider = await Provider.create({
      ownerId: user._id,
      label: src.label,
      type: src.type,
      baseURL: src.baseURL,
      apiKeyEncrypted: src.apiKeyEncrypted,
      defaultModel: src.defaultModel,
      isDefault: true,
    });
  }
  return { user, provider, apiKey: encryption.decrypt(src.apiKeyEncrypted) };
}

export async function ensureUser({ name, email, slug }) {
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ name, email, clerkId: `sim_${slug}`, username: slug, role: 'normal' });
  return user;
}

export async function newThread({ agentId, userId, title, skillId }) {
  return await threadRepository.create({
    agentId,
    userId,
    subjectType: 'PersonaUser',
    threadId: crypto.randomUUID(),
    title,
    ...(skillId ? { skillId } : {}),
  });
}

/**
 * One turn. Returns { text, tools, interrupt, error } where interrupt is
 * { kind: 'hitl'|'clarification', value } if the run paused.
 */
export async function runTurn({ agentId, userId, thread, content, resume, contextOverride, log }) {
  let text = '';
  const tools = [];
  let interrupt = null;
  let error = null;
  const started = Date.now();
  for await (const ev of runAgentAsAguiEvents({
    agentId,
    userId,
    langGraphThreadId: thread.threadId,
    threadDbId: thread._id,
    messages: [{ id: crypto.randomUUID(), role: 'user', content }],
    resume,
    contextOverride,
  })) {
    if (ev.type === 'TEXT_MESSAGE_CHUNK' || ev.type === 'TEXT_MESSAGE_CONTENT') {
      if (ev.role !== 'reasoning') text += ev.delta ?? ev.content ?? '';
    } else if (ev.type === 'TOOL_CALL_CHUNK' || ev.type === 'TOOL_CALL_START') {
      let t = tools.find((x) => x.id === ev.toolCallId);
      if (!t) { t = { name: ev.toolCallName || 'tool', id: ev.toolCallId, args: '' }; tools.push(t); }
      if (ev.toolCallName) t.name = ev.toolCallName;
      t.args += ev.delta ?? ev.args ?? '';
    } else if (ev.type === 'TOOL_CALL_RESULT') {
      const t = tools.find((x) => x.id === ev.toolCallId);
      if (t) t.result = String(ev.content ?? '').slice(0, 400);
    } else if (ev.type === 'CUSTOM' && (ev.name === 'hitl_request' || ev.name === 'clarification_request')) {
      interrupt = { kind: ev.name === 'hitl_request' ? 'hitl' : 'clarification', value: ev.value };
    } else if (ev.type === 'RUN_ERROR') error = ev.message;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (log) log(`   (${seconds}s · tools: ${tools.map((t) => t.name).join(', ') || 'none'}${interrupt ? ' · paused: ' + interrupt.kind : ''}${error ? ' · ERROR ' + error : ''})`);
  return { text, tools, interrupt, error, seconds };
}

/** Auto-approve a HITL interrupt (the creator clicks Approve). */
export function approveAll(interrupt) {
  const n = interrupt?.value?.actionRequests?.length || 1;
  return { decisions: Array.from({ length: n }, () => ({ type: 'approve' })) };
}

/** Structured resume for a clarification interrupt (what the UI sends). */
export function clarificationResume(interrupt, text) {
  const qs = interrupt?.value?.questions || [];
  const answers = qs.map((q, i) => ({ index: i, question: q.question || q.text || q.prompt || '', answer: text }));
  return { answers: answers.length ? answers : [{ index: 0, question: '', answer: text }], text };
}

export function clarificationQuestionsText(interrupt) {
  const qs = interrupt?.value?.questions || [];
  return qs
    .map((q, i) => {
      const opts = (q.options || []).map((o) => (typeof o === 'string' ? o : o.label || o.value)).filter(Boolean);
      return `${i + 1}. ${q.question || q.text || q.prompt || JSON.stringify(q)}${opts.length ? ` [options: ${opts.join(' / ')}]` : ''}`;
    })
    .join('\n');
}

/** The simulated human: an LLM playing a brief, replying to the agent. */
export function makeSimulator({ apiKey, model = 'gpt-5-mini', system }) {
  const llm = new ChatOpenAI({ apiKey, model, temperature: 1 });
  const history = [];
  return {
    history,
    async reply(agentMessage) {
      history.push({ role: 'assistant', content: agentMessage });
      const res = await llm.invoke([
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role === 'assistant' ? 'user' : 'assistant', content: m.content })),
      ]);
      const out = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
      history.push({ role: 'user', content: out });
      return out;
    },
  };
}

/** LLM judge: returns parsed JSON from the model. */
export async function judge({ apiKey, model = 'gpt-5', system, user }) {
  const llm = new ChatOpenAI({ apiKey, model, temperature: 1 });
  const res = await llm.invoke([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  const m = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m ? m[0] : raw);
  } catch {
    return { raw };
  }
}

export function parseSimJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return { reply: String(text).trim(), done: false };
  try {
    const o = JSON.parse(m[0]);
    return { reply: String(o.reply ?? '').trim(), done: Boolean(o.done), note: o.note };
  } catch {
    return { reply: String(text).trim(), done: false };
  }
}

export async function snapshotCreator(userId) {
  const persona = await Agent.findOne({ ownerId: userId, isMainAgent: true, isActive: true }).populate('skills');
  const agents = await Agent.find({ ownerId: userId, isActive: true });
  const skills = await Skill.find({ ownerId: userId });
  return { persona, agents, skills };
}

export function writeTranscript(file, { title, meta, turns }) {
  const lines = [`# ${title}`, ''];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) lines.push(`- **${k}:** ${v}`);
    lines.push('');
  }
  for (const t of turns) {
    lines.push(`### ${t.who}`);
    lines.push('');
    lines.push(t.text || '_(no text)_');
    if (t.tools?.length) lines.push('', `> tools: ${t.tools.map((x) => x.name).join(', ')}`);
    if (t.paused) lines.push('', `> paused for ${t.paused}${t.detail ? ': ' + t.detail : ''}`);
    if (t.seconds) lines.push('', `> ${t.seconds}s`);
    lines.push('');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n'));
}

export function md(s) {
  return String(s ?? '').replace(/\r/g, '');
}
