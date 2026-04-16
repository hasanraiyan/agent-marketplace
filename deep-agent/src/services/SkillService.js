/**
 * Single Responsibility: Logic for loading and managing agent skills in storage.
 * Open-Closed Principle: You can extend this to load from a DB, S3, etc., without changing the agent.
 */
export class SkillService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Loads a skill into the store.
   * @param {string} id - The unique identifier for the skill.
   * @param {string} content - The SKILL.md content with frontmatter.
   */
  async loadSkill(id, content) {
    console.log(`[SkillService] Loading skill: ${id}`);
    
    await this.store.put(
      ["filesystem"], 
      `/skills/${id}/SKILL.md`, 
      { 
        content: Buffer.from(content).toString("base64"),
        encoding: "base64"
      }
    );
  }

  /**
   * Removes a skill from the store.
   * @param {string} id - The skill to remove.
   */
  async removeSkill(id) {
    console.log(`[SkillService] Removing skill: ${id}`);
    // Future implementation: store.delete(...)
  }
}
