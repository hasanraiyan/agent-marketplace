/** Rebuild a creator-session transcript from the thread checkpoint (for runs killed before writing). */
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import './../../src/modules/agents/agent.model.js';
import User from '../../src/modules/users/user.model.js';
import Conversation from '../../src/modules/threads/thread.model.js';
import checkpointService from '../../src/modules/threads/checkpoint.service.js';
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOne({ email: arg('--email') });
const t = await Conversation.findOne({ userId: user._id, title: arg('--title') }).sort({ createdAt: -1 });
const snap = await checkpointService.checkpointer.getTuple({ configurable: { thread_id: t.threadId } });
const msgs = snap?.checkpoint?.channel_values?.messages || [];
const lines = [`# ${arg('--heading')}`, '', `- **date:** ${t.createdAt.toISOString().slice(0, 10)}`, `- **note:** rebuilt from the thread checkpoint (the run was killed before the transcript was written)`, ''];
let toolBuf = [];
for (const m of msgs) {
  const type = m._getType?.() || m.type;
  const text = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((p) => p.text || '').join('') : '';
  if (type === 'human') { lines.push(`### Creator`, '', text, ''); }
  else if (type === 'ai') {
    const tools = (m.tool_calls || []).map((x) => x.name);
    if (text.trim()) lines.push(`### Architect`, '', text, '');
    if (tools.length) lines.push(`> tools: ${tools.join(', ')}`, '');
  }
}
fs.writeFileSync(arg('--out'), lines.join('\n'));
console.log('wrote', arg('--out'), 'messages:', msgs.length);
process.exit(0);
