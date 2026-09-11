/**
 * Static meta-skills mounted for the Persona Architect under /skills/.
 * Loaded from modules/skills/architect/*.md at startup so they can be edited
 * as plain markdown. The Architect reads them like any other skill.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ARCHITECT_SKILL } from './architectSkill.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'architect');
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

export const ARCHITECT_STATIC_SKILL_FILES = {
  '/agent-architecture/SKILL.md': ARCHITECT_SKILL,
  '/persona-crafting/SKILL.md': read('persona-crafting.md'),
  '/skill-training/SKILL.md': read('skill-training.md'),
  '/skill-training/references/skill-verbs.md': read('references/skill-verbs.md'),
  '/skill-training/references/playbook-template.md': read('references/playbook-template.md'),
};
