import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { getConfig } from '@langchain/langgraph';
import clientProjectService from './clientProject.service.js';

/**
 * Project tools every firm employee carries. They read the active
 * ClientProject id from the run's `configurable.projectId` (set by the AG-UI
 * middleware when the client chats from a project workspace), so one compiled
 * agent serves every project without rebuilding.
 */

function activeProjectId() {
  return getConfig()?.configurable?.projectId || null;
}

const NO_PROJECT =
  'No active project in this conversation. Ask the client to open the project workspace, or continue as a general conversation.';

export const getProjectTool = () =>
  new DynamicStructuredTool({
      name: 'get_project',
      description:
        'Read the active project: the scope of work, each deliverable with its status and index, what the client already provided, open requests, and recent activity. Call this before planning work.',
      schema: z.object({}),
    func: async () => {
      const id = activeProjectId();
      if (!id) return NO_PROJECT;
      const brief = await clientProjectService.agentGetBrief(id);
      return brief ? JSON.stringify(brief, null, 2) : 'Project not found';
    },
  });

export const updateDeliverableTool = () =>
  new DynamicStructuredTool({
      name: 'update_deliverable',
      description:
        'Mark a scope-of-work deliverable as in_progress when you start it, or delivered when it is complete and written to a file in /workspace/outputs/. Include a one-line note and the artifact path. The client accepts delivered work from their dashboard.',
      schema: z.object({
        index: z.number().int().min(0).describe('Deliverable index from get_project'),
        status: z.enum(['in_progress', 'delivered']),
        note: z.string().max(500).optional().describe('One line on what was done'),
        artifactPath: z.string().max(300).optional().describe('Path under /workspace/outputs/'),
      }),
    func: async ({ index, status, note, artifactPath }) => {
      const id = activeProjectId();
      if (!id) return NO_PROJECT;
      const r = await clientProjectService.agentUpdateDeliverable(id, { index, status, note, artifactPath });
      return JSON.stringify(r);
    },
  });

export const requestFromClientTool = () =>
  new DynamicStructuredTool({
      name: 'request_from_client',
      description:
        'Use when work is blocked on something only the client can provide (a document, a decision, an answer). It lands in their "needed from you" inbox and marks the project blocked until they answer. Ask for one concrete thing per request.',
      schema: z.object({
        ask: z.string().min(5).max(1000),
        dueInDays: z.number().int().min(1).max(60).optional(),
      }),
    func: async ({ ask, dueInDays }) => {
      const id = activeProjectId();
      if (!id) return NO_PROJECT;
      const r = await clientProjectService.agentRequestFromClient(id, { ask, dueInDays });
      return JSON.stringify(r);
    },
  });

export const logProgressTool = () =>
  new DynamicStructuredTool({
      name: 'log_progress',
      description:
        'Post a short progress note to the project activity feed the client and the firm owner both watch. Use for meaningful milestones, not every step.',
      schema: z.object({ message: z.string().min(3).max(2000) }),
    func: async ({ message }) => {
      const id = activeProjectId();
      if (!id) return NO_PROJECT;
      return JSON.stringify(await clientProjectService.agentLogProgress(id, message));
    },
  });

export const getFirmProjectToolbox = () => [
  getProjectTool(),
  updateDeliverableTool(),
  requestFromClientTool(),
  logProgressTool(),
];

/** Text injected into the system prompt for a run that has an active project. */
export function buildProjectContext(brief) {
  const lines = [];
  lines.push(`Project: ${brief.title}`);
  lines.push(`Promised outcome: ${brief.outcome}`);
  lines.push(`Client: ${brief.client} · Status: ${brief.status} · Progress: ${brief.progress}%`);
  if (brief.dueAt) lines.push(`Due: ${new Date(brief.dueAt).toDateString()}`);
  lines.push('');
  lines.push('Scope of work (index · deliverable · status):');
  for (const d of brief.deliverables) {
    lines.push(`  ${d.index} · ${d.name} · ${d.status}${d.acceptanceCriteria ? ` — accept when: ${d.acceptanceCriteria}` : ''}`);
  }
  const inputs = Object.entries(brief.inputs || {});
  if (inputs.length) {
    lines.push('');
    lines.push('What the client provided at start:');
    for (const [k, v] of inputs) lines.push(`  ${k}: ${String(v).slice(0, 600)}`);
  }
  if (brief.openRequests?.length) {
    lines.push('');
    lines.push('Open requests waiting on the client:');
    for (const r of brief.openRequests) lines.push(`  - ${r.ask}`);
  }
  if (brief.answeredRequests?.length) {
    lines.push('');
    lines.push('Recently answered requests:');
    for (const r of brief.answeredRequests) lines.push(`  - ${r.ask} → ${String(r.response).slice(0, 400)}`);
  }
  if (brief.checkpoints?.length) {
    lines.push('');
    lines.push(`Human checkpoints (the firm owner steps in): ${brief.checkpoints.join('; ')}`);
  }
  lines.push('');
  lines.push('Rules for this project:');
  lines.push('- You are executing a signed scope of work. Work toward the deliverables above, in order, using your skills. Do not promise outcomes outside the scope.');
  lines.push('- Call get_project when you need the latest state. Call update_deliverable(in_progress) when you begin one and update_deliverable(delivered) when it is done and written to /workspace/outputs/. Then present_file it.');
  lines.push('- If you cannot proceed without something from the client, call request_from_client with one concrete ask, then continue with whatever is not blocked.');
  lines.push('- Delegate specialist work to the right employee via the task tool; you remain accountable for the deliverable.');
  lines.push('- Keep replies short and concrete: what you did, what is next, what you need.');
  return lines.join('\n');
}
