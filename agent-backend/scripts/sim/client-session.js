/**
 * Simulated clients talk to a creator's persona; an LLM judge grades each
 * transcript against the creator's brief.
 *   node scripts/sim/client-session.js --brief scripts/sim/briefs/priya.js --clients scripts/sim/briefs/priya-clients.js --out specs/case-studies/priya-nair --run 1 [--turns 6] [--only arjun]
 */
import fs from 'fs';
import path from 'path';
import Agent from '../../src/modules/agents/agent.model.js';
import Skill from '../../src/modules/skills/skill.model.js';
import {
  connect, ensureCreator, ensureUser, newThread, runTurn, clarificationQuestionsText, clarificationResume,
  makeSimulator, parseSimJson, judge, writeTranscript,
} from './lib.js';

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const briefPath = arg('--brief');
const clientsPath = arg('--clients');
const outDir = arg('--out');
const run = arg('--run', '1');
const maxTurns = parseInt(arg('--turns', '6'), 10);
const only = arg('--only');
const ownerEmail = arg('--owner-email', 'namanjha025@gmail.com');
if (!briefPath || !clientsPath || !outDir) { console.error('usage: --brief --clients --out [--run] [--turns] [--only]'); process.exit(1); }

const brief = (await import(path.resolve(briefPath))).default;
const clients = (await import(path.resolve(clientsPath))).default.filter((c) => !only || c.slug === only);
const log = (s) => console.log(s);

await connect();
const { user: creator, apiKey } = await ensureCreator(brief.account, ownerEmail);
const persona = await Agent.findOne({ ownerId: creator._id, isMainAgent: true, isActive: true }).populate('skills');
if (!persona) throw new Error('creator has no persona yet');
log(`persona: ${persona.name} (${persona._id}) · skills: ${(persona.skills || []).map((s) => s.name).join(', ') || 'none'}`);
if (persona.visibility !== 'public') { persona.visibility = 'public'; await persona.save(); }

const dir = path.resolve(outDir);
fs.mkdirSync(dir, { recursive: true });
const results = [];

for (const c of clients) {
  log(`\n════ client: ${c.name} (${c.slug}) ════`);
  const client = await ensureUser({ name: c.name, email: `${c.slug}@sim-clients.dev`, slug: c.slug });
  let skill = null;
  if (c.skill) skill = await Skill.findOne({ ownerId: creator._id, name: c.skill });
  const thread = await newThread({ agentId: persona._id, userId: client._id, title: `sim client ${c.slug} run ${run}`, skillId: skill?._id });
  const contextOverride = skill
    ? `### PINNED SKILL: ${skill.title || skill.name}\n${skill.hook ? skill.hook + '\n' : ''}The visitor came here to use this specific skill of yours. Apply it deliberately in this conversation; if the request drifts outside it, say what the skill covers and still help.\n\n${skill.instructions}`
    : undefined;

  const sim = makeSimulator({
    apiKey,
    model: brief.simModel || 'gpt-5-mini',
    system: `You are ${c.name}, a real person chatting with ${persona.name}'s AI persona (a ${brief.account.name} replica) because you want help. Stay in character; be natural, sometimes vague, sometimes emotional, like a real client. Never mention you are simulated.

Your situation:
${c.situation}

What you're trying to get out of this: ${c.wants}
${c.probe ? `\nAt some point (around your 3rd or 4th message), also bring up: ${c.probe}` : ''}

Reply in 1–5 sentences, answering what the persona asked and pushing toward what you want. Reply ONLY as JSON: {"reply": "<what you say>", "done": <true only if you feel you got what you came for or would leave>}`,
  });

  const turns = [];
  let content = c.opening;
  let resume;
  for (let t = 1; t <= maxTurns; t++) {
    turns.push({ who: `Client (${c.name})`, text: content });
    log(`[${t}] CLIENT: ${content.slice(0, 200)}`);
    const r = await runTurn({ agentId: String(persona._id), userId: client._id, thread, content, resume, contextOverride, log });
    resume = undefined;
    const qs = r.interrupt?.kind === 'clarification' ? clarificationQuestionsText(r.interrupt) : '';
    const filesText = (r.presented || []).map((f) => `\n\n[file presented: ${f.path}]\n${f.content}`).join('');
    turns.push({ who: persona.name, text: r.text + filesText, tools: r.tools, paused: r.interrupt?.kind, detail: qs, seconds: r.seconds });
    log(`[${t}] PERSONA: ${r.text.slice(0, 400)}${r.text.length > 400 ? '…' : ''}`);
    if (qs) log(`   asks: ${qs.slice(0, 300)}`);
    if (r.error) { log('run error'); break; }
    if (t === maxTurns) break;
    const out = parseSimJson(await sim.reply(r.text + filesText + (qs ? `\n\n[${persona.name} asks:]\n${qs}` : '')));
    content = out.reply || 'Okay.';
    if (r.interrupt?.kind === 'clarification') resume = clarificationResume(r.interrupt, content);
    if (out.done) { turns.push({ who: `Client (${c.name})`, text: content + '  _(leaves satisfied)_' }); log(`CLIENT (done): ${content}`); break; }
  }

  const transcript = turns.map((t) => `${t.who}: ${t.text}${t.detail ? '\n[asks] ' + t.detail : ''}`).join('\n\n');
  const verdict = await judge({
    apiKey,
    system: `You are a strict evaluator of AI personas built from real experts. You will grade ONE conversation between a client and the persona of ${brief.account.name}. You know the real expert from this profile:\n${brief.profile}\n\nScore each criterion 0–3 (0 absent/wrong, 1 weak, 2 good, 3 indistinguishable from the real expert) and explain in one line each, quoting the transcript where useful. Then give: the single biggest weakness, what a client would say afterwards in one sentence, and whether they'd come back (yes/no). Be harsh on generic advice, on advising before intake, and on breaking the expert's rules or boundaries.`,
    user: `CRITERIA:\n1. voice — sounds like the expert (tone, phrasing, first person, no exclamation marks if the expert avoids them)\n2. intake — asks the expert's always-ask-first questions before advising; doesn't re-ask known things\n3. rules — applies the expert's rules with their reasons; never contradicts them\n4. specificity — concrete, situation-specific, no generic coach-speak\n5. boundaries — handles the expert's hand-offs and refusals the way the expert would (if triggered)\n6. usefulness — the client leaves with something actionable\n7. pacing — reply length and question count fit a chat; not a wall of text, not a form\n\nCLIENT SITUATION: ${c.situation}\nCLIENT WANTED: ${c.wants}\n${c.probe ? 'PROBE: ' + c.probe : ''}\n\nTRANSCRIPT:\n${transcript}\n\nReturn JSON only: {"scores": {"voice": n, "intake": n, "rules": n, "specificity": n, "boundaries": n, "usefulness": n, "pacing": n}, "notes": {"voice": "...", "intake": "...", "rules": "...", "specificity": "...", "boundaries": "...", "usefulness": "...", "pacing": "..."}, "biggest_weakness": "...", "client_quote": "...", "would_return": "yes|no", "total": n}`,
  });
  const total = verdict.total ?? Object.values(verdict.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  log(`JUDGE: total ${total}/21 · weakest: ${verdict.biggest_weakness}`);
  results.push({ client: c.slug, total, verdict });

  writeTranscript(path.join(dir, `client-session-${run}-${c.slug}.md`), {
    title: `Client session ${run} — ${c.name} × ${persona.name}`,
    meta: { date: new Date().toISOString().slice(0, 10), skillPinned: skill?.name || 'none', judgeTotal: `${total}/21`, wouldReturn: verdict.would_return, biggestWeakness: verdict.biggest_weakness, clientQuote: verdict.client_quote },
    turns,
  });
  fs.appendFileSync(path.join(dir, `judge-${run}.json`), JSON.stringify({ client: c.slug, ...verdict }, null, 2) + '\n');
}
console.log('\nSUMMARY ' + JSON.stringify(results.map((r) => ({ client: r.client, total: r.total, return: r.verdict.would_return }))));
process.exit(0);
