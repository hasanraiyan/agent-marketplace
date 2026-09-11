/** Dev comes back after watching two reviews. */
import base from './dev.js';
export default {
  ...base,
  opening: `Watched two reviews. Three fixes. One: a guy pasted his numbers in the first message and my persona still told him to "fill the card". If the numbers are there, use them; ask only for what's missing. Two: the intake has turned into a ten-field form. I ask two things: what must it do and not do, and the numbers. That's it; SLAs and the rest I pull out as I read. Three: the score table and the verdict must be in the chat message itself, short, with the full write-up in the file. People read the chat, not the attachment. Four: someone's audit log was going to carry PCI data and my persona gave DLP and KMS guidance like it was its call. That's my hand-off: I flag it, I say get your security team, I don't sign off. Make the changes and show me one real test where the numbers are already in the first message.`,
  goal: 'Get the four fixes into the skill playbook (and persona prompt if needed). Approve tool calls. Ask for one real test. When it looks right, say you are done. No new skills.',
};
