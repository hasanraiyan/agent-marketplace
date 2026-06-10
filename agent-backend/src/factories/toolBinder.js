import { resolveAgentTools, ARCHITECT_AGENT_ID } from '../tools/index.js';
import { ARCHITECT_SKILL } from '../skills/architectSkill.js';

/**
 * Resolves tools and materializes skills for the agent.
 * @param {Object} agent - The agent configuration object.
 * @param {string} userId - The ID of the user.
 * @returns {Object} An object containing dynamicTools, skillFiles, and hasSkills.
 */
export function bindTools(agent, userId) {
  const agentIdStr = agent._id ? agent._id.toString() : '';

  // 1. Resolve Dynamic Tools
  const dynamicTools = resolveAgentTools(agent, userId);

  // 2. Materialize Skills
  const skillFiles = {};
  const now = new Date().toISOString();

  // Inject Hardcoded Architect Skill if applicable
  if (agentIdStr === ARCHITECT_AGENT_ID) {
    skillFiles['/skills/agent-architecture/SKILL.md'] = {
      content: ARCHITECT_SKILL.split('\n'),
      created_at: now,
      modified_at: now,
    };
  }

  // Materialize user-defined skills
  if (agent.skills && agent.skills.length > 0) {
    for (const skill of agent.skills) {
      // Slugify the directory segment so odd skill names can't break the path.
      const dir =
        String(skill.name)
          .trim()
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase() || 'skill';
      const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`;
      skillFiles[`/skills/${dir}/SKILL.md`] = {
        content: frontmatter.split('\n'),
        created_at: now,
        modified_at: now,
      };
    }
  }

  const hasSkills = Object.keys(skillFiles).length > 0;

  return {
    dynamicTools,
    skillFiles,
    hasSkills,
  };
}
