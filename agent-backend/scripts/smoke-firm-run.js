/**
 * Engine smoke test: start a client project on a seeded firm and run one
 * agent turn through the same path the AG-UI route uses.
 *
 *   node scripts/smoke-firm-run.js --client-email you@example.com [--firm northstar-founders] [--project raise-ready-in-4-weeks] [--message "..."]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
// Register every model the factory populates (the server does this via index.js).
import '../src/modules/stores/store.model.js';
import '../src/modules/mcp/mcp.model.js';
import '../src/modules/mcp/mcp-user-connection.model.js';
import '../src/modules/knowledge/knowledge-base.model.js';
import '../src/modules/restApiTools/restApiTool.model.js';
import clientProjectService from '../src/modules/firms/clientProject.service.js';
import { buildProjectContext } from '../src/modules/firms/firm.tools.js';
import { runAgentAsAguiEvents } from '../src/modules/agui/agui.service.js';
import { personaExecutionContext } from '../src/modules/agents/agent.service.js';

function arg(name, dflt = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const clientEmail = arg('--client-email');
const firmSlug = arg('--firm', 'northstar-founders');
const projectSlug = arg('--project', 'raise-ready-in-4-weeks');
const message = arg('--message', 'Kick off the project. Start with the first deliverable.');
const existingProjectId = arg('--project-id');

const SAMPLE_INPUTS = {
  'raise-ready-in-4-weeks': {
    company: 'Humans & Harness lets any expert turn their expertise into a one-person AI-native consulting firm that sells executed outcomes under a scope of work.',
    stage: 'Working platform with agent runtime, skills, and multi-tenant infra. Four pilot firms live. No revenue yet; two design partners committed.',
    round: '$600k pre-seed for 15 months of runway',
    deck: '',
    founders: 'Solo technical founder, AI engineer, previously built an agent marketplace and a study-abroad application platform.',
  },
  '12-week-fitness-foundation': {
    goal: 'Lose 6 kg and deadlift bodyweight in 12 weeks; stop the 3pm crash.',
    history: 'Trained on and off for years, last consistent stretch was 8 months ago. Mild lower back tightness with conventional deadlifts.',
    logistics: '3 days a week, dumbbells up to 25 kg and a pull-up bar at home. Kitchen defaults: eggs, rice, chicken thighs, greek yogurt, oats, bananas.',
    health: 'Weight 84 kg, sleep averages 6.2 h, steps ~5,500/day.',
  },
  'o-1-gap-analysis-and-90-day-evidence-plan': {
    background: 'Senior AI engineer, 7 years, at a mid-size fintech; previously two startups.',
    achievements: 'Built the fraud model serving 4M users; open-source library with 2.1k stars; spoke at two regional conferences; quoted in one trade publication; judged a university hackathon once.',
    timeline: 'File in ~9 months; currently on H-1B',
    links: '',
  },
  'interview-ready-in-12-weeks': {
    level: 'Senior backend engineer, 6 years, targeting staff',
    targets: 'Two large tech companies, interviews in ~3 months',
    hours: '5',
    sample: 'Design a URL shortener: I would use a hash of the URL stored in a key-value store with a cache in front, and add sharding when it grows. Reads go through the cache, writes go to the DB. We could use Kafka for analytics.',
  },
};

async function main() {
  if (!clientEmail) throw new Error('--client-email required');
  await mongoose.connect(process.env.MONGODB_URI);
  const client = await User.findOne({ email: clientEmail.toLowerCase() });
  if (!client) throw new Error(`no user ${clientEmail}`);

  let project;
  if (existingProjectId) {
    project = await clientProjectService.getForUser(existingProjectId, client._id);
  } else {
    const inputs = SAMPLE_INPUTS[projectSlug] || {};
    const started = await clientProjectService.startProject(client._id, firmSlug, projectSlug, inputs);
    project = started.project;
    console.log(`✓ started project ${project._id} "${project.title}" thread=${started.thread._id} lead=${project.leadAgentId?.name}`);
  }

  const brief = await clientProjectService.agentGetBrief(project._id);
  const contextOverride = `### ACTIVE PROJECT\n${buildProjectContext(brief)}`;
  console.log(`\n--- context (${contextOverride.length} chars) ---\n${contextOverride.slice(0, 600)}\n...`);

  const threadDoc = await (await import('../src/modules/threads/thread.repository.js')).default.findById(project.threadId);
  const executionContext = { ...personaExecutionContext(client._id), firmId: String(project.firmId?._id || project.firmId) };

  console.log(`\n--- run: "${message}" ---`);
  let text = '';
  const toolCalls = [];
  const custom = [];
  const started = Date.now();
  for await (const ev of runAgentAsAguiEvents({
    agentId: String(project.leadAgentId?._id || project.leadAgentId),
    userId: client._id,
    langGraphThreadId: threadDoc.threadId,
    threadDbId: threadDoc._id,
    messages: [{ id: 'm1', role: 'user', content: message }],
    contextOverride,
    projectId: String(project._id),
    executionContext,
  })) {
    if (ev.type === 'TEXT_MESSAGE_CONTENT') text += ev.delta || '';
    else if (ev.type === 'TOOL_CALL_START') toolCalls.push(ev.toolCallName);
    else if (ev.type === 'CUSTOM') custom.push(ev.name);
    else if (ev.type === 'RUN_ERROR') console.error('RUN_ERROR', ev.message);
  }
  console.log(`\n--- done in ${((Date.now() - started) / 1000).toFixed(1)}s ---`);
  console.log('tools called:', toolCalls.join(', ') || '(none)');
  console.log('custom events:', [...new Set(custom)].join(', ') || '(none)');
  console.log('\n--- assistant text ---\n' + text.slice(0, 2500));

  const after = await clientProjectService.getForUser(project._id, client._id);
  console.log('\n--- project after ---');
  console.log('status:', after.status, '| progress:', after.progress);
  for (const d of after.sow.deliverables) console.log(`  [${d.status}] ${d.name}${d.artifactPath ? ' → ' + d.artifactPath : ''}`);
  console.log('inbox open:', after.inbox.filter((i) => i.status === 'open').map((i) => i.ask));
  console.log('activity:', after.activity.slice(-6).map((a) => `${a.by}: ${a.message}`));
  console.log(`\nproject id: ${after._id}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
