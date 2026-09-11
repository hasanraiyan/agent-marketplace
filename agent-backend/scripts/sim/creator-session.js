/**
 * A simulated creator builds their persona + one skill through the Architect.
 *   node scripts/sim/creator-session.js --brief scripts/sim/briefs/priya.js --out specs/case-studies/priya-nair --run 1 [--max 16]
 */
import fs from 'fs';
import path from 'path';
import {
  connect, ensureCreator, newThread, runTurn, approveAll, clarificationQuestionsText, clarificationResume,
  makeSimulator, parseSimJson, snapshotCreator, writeTranscript, ARCHITECT_AGENT_ID,
} from './lib.js';

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const briefPath = arg('--brief');
const outDir = arg('--out');
const run = arg('--run', '1');
const max = parseInt(arg('--max', '16'), 10);
const ownerEmail = arg('--owner-email', 'namanjha025@gmail.com');
if (!briefPath || !outDir) { console.error('usage: --brief <file> --out <dir> [--run N]'); process.exit(1); }

const brief = (await import(path.resolve(briefPath))).default;
const log = (s) => console.log(s);

await connect();
const { user, apiKey } = await ensureCreator(brief.account, ownerEmail);
log(`creator: ${user.name} <${user.email}> (${user._id})`);

const sim = makeSimulator({
  apiKey,
  model: brief.simModel || 'gpt-5-mini',
  system: `You are ${brief.account.name}, a real person using a product that turns you into an AI persona and trains it on your skills. You are talking to "the Architect", the product's setup assistant.

Your background and how you actually work (answer from this; be specific, use your own phrasing, share real examples; never invent credentials you don't have here):
${brief.profile}

What you want today: ${brief.goal}

How to behave:
- Answer what the Architect asks, in a natural, slightly busy tone. 1–6 sentences usually; longer when asked to walk through how you do something.
- When asked to approve or correct a draft, compare it with your profile. Correct it ONLY if it contradicts or omits something in your profile, with one concrete correction. Otherwise approve. Never invent new requirements, exact formats, mandatory fields, line counts, or wording rules that are not in your profile; you are busy and you trust the Architect on structure.
- If the Architect asks questions with options, pick the option that matches you (say it in words).
- If the Architect asks something you already answered, say so briefly and move on.
- Never write the playbook or prompt yourself; that is the Architect's job. You give raw material and reactions.
- You are NOT done until the Architect has actually made the changes (created/updated things, run a test and shown you the persona's real reply) and explicitly says the work is complete. Answering questions is never "done". If the Architect asks you something, answer it with done=false.

Reply ONLY as JSON: {"reply": "<what you say>", "done": <true ONLY after the Architect has confirmed everything is built/updated and tested; otherwise false>}`,
});

const thread = await newThread({ agentId: ARCHITECT_AGENT_ID, userId: user._id, title: `sim creator run ${run}` });
const turns = [];
let content = brief.opening;
let resume;
let pending = null;
let turn = 0;
let mutated = false;
const MUTATORS = new Set(['upsert_agent', 'manage_skill', 'write_file', 'edit_file', 'delete_agent']);
while (turn < max) {
  turn += 1;
  turns.push({ who: `Creator (${brief.account.name})`, text: content });
  log(`\n[${turn}] CREATOR: ${content.slice(0, 160)}${content.length > 160 ? '…' : ''}`);
  const r = await runTurn({ agentId: ARCHITECT_AGENT_ID, userId: user._id, thread, content, resume, log });
  resume = undefined;
  if (r.tools.some((t) => MUTATORS.has(t.name))) mutated = true;
  let shown = r.text;
  let detail = '';
  if (r.interrupt?.kind === 'clarification') detail = clarificationQuestionsText(r.interrupt);
  if (r.interrupt?.kind === 'hitl') detail = (r.interrupt.value?.actionRequests || []).map((a) => a.name).join(', ');
  turns.push({ who: 'Architect', text: shown, tools: r.tools, paused: r.interrupt?.kind, detail, seconds: r.seconds });
  log(`[${turn}] ARCHITECT: ${shown.slice(0, 300)}${shown.length > 300 ? '…' : ''}`);
  if (detail) log(`   ${r.interrupt.kind}: ${detail.slice(0, 300)}`);
  if (r.error) { log('run error, stopping'); break; }

  if (r.interrupt?.kind === 'hitl') {
    // The creator approves tool calls.
    resume = approveAll(r.interrupt);
    content = 'Approved.';
    turns.push({ who: `Creator (${brief.account.name})`, text: '(approves)' });
    turn += 1;
    const r2 = await runTurn({ agentId: ARCHITECT_AGENT_ID, userId: user._id, thread, content, resume, log });
    resume = undefined;
    if (r2.tools.some((t) => MUTATORS.has(t.name))) mutated = true;
    turns.push({ who: 'Architect', text: r2.text, tools: r2.tools, paused: r2.interrupt?.kind, detail: r2.interrupt?.kind === 'clarification' ? clarificationQuestionsText(r2.interrupt) : (r2.interrupt?.value?.actionRequests || []).map((a) => a.name).join(', '), seconds: r2.seconds });
    log(`[${turn}] ARCHITECT: ${r2.text.slice(0, 300)}${r2.text.length > 300 ? '…' : ''}`);
    if (r2.error) { log('run error, stopping'); break; }
    if (r2.interrupt?.kind === 'hitl') { resume = approveAll(r2.interrupt); content = 'Approved.'; continue; }
    pending = r2.interrupt;
    shown = r2.text + (r2.interrupt?.kind === 'clarification' ? `\n\n[The Architect asks:]\n${clarificationQuestionsText(r2.interrupt)}` : '');
  } else {
    pending = r.interrupt;
    shown = r.text + (r.interrupt?.kind === 'clarification' ? `\n\n[The Architect asks:]\n${clarificationQuestionsText(r.interrupt)}` : '');
  }
  const simOut = parseSimJson(await sim.reply(shown || '(the Architect did not say anything)'));
  content = simOut.reply || 'Go on.';
  if (pending?.kind === 'clarification') resume = clarificationResume(pending, content);
  const architectAsked = Boolean(pending) || /\?\s*$/.test((shown || '').trim().split('\n').pop() || '');
  if (simOut.done && (!mutated || architectAsked)) log('   (sim said done too early — ignored)');
  if (simOut.done && mutated && !architectAsked) {
    turns.push({ who: `Creator (${brief.account.name})`, text: content + '  _(done)_' });
    log(`\nCREATOR (done): ${content}`);
    break;
  }
}

const snap = await snapshotCreator(user._id);
const dir = path.resolve(outDir);
fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
writeTranscript(path.join(dir, `creator-session-${run}.md`), {
  title: `Creator session ${run} — ${brief.account.name} × Architect`,
  meta: { date: new Date().toISOString().slice(0, 10), turns: turns.length, persona: snap.persona?.name || '(none)', skills: snap.skills.map((s) => s.name).join(', ') || '(none)' },
  turns,
});
// artifacts
if (snap.persona) {
  fs.writeFileSync(path.join(dir, 'artifacts', `persona-run-${run}.md`), `# Persona: ${snap.persona.name}\n\n- tagline: ${snap.persona.tagline}\n- description: ${snap.persona.description}\n- visibility: ${snap.persona.visibility}\n- skills attached: ${(snap.persona.skills || []).map((s) => s.name).join(', ') || 'none'}\n\n## System prompt\n\n\`\`\`\n${snap.persona.systemPrompt}\n\`\`\`\n`);
}
for (const s of snap.skills) {
  const files = (s.files || []).map((f) => `\n\n---\n\n## ${f.path}\n\n${f.content}`).join('');
  fs.writeFileSync(path.join(dir, 'artifacts', `skill-${s.name}-run-${run}.md`), `# Skill: ${s.name}\n\n- title: ${s.title || ''}\n- description: ${s.description}\n- visibility: ${s.visibility}\n- files: ${(s.files || []).length}\n\n## SKILL.md\n\n${s.instructions}${files}\n`);
}
console.log(JSON.stringify({ personaId: snap.persona?._id, persona: snap.persona?.name, skills: snap.skills.map((s) => ({ name: s.name, files: (s.files || []).length, lines: String(s.instructions).split('\n').length })), turns: turns.length }, null, 2));
process.exit(0);
