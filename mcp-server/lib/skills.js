/**
 * skills.js — the skills this package ships, in skills/<name>/SKILL.md: each one
 * file, served as its prompt (plan 700 Q8).
 *
 * Map:
 * - skill — a skill's steps: its SKILL.md, without its frontmatter
 * - prompted — a prompt's one message: what the agent was asked, then the skill's steps
 */
import { readFileSync } from 'node:fs';

/** A skill's steps: its SKILL.md, without its frontmatter. */
export const skill = (name) => readFileSync(new URL(`../skills/${name}/SKILL.md`, import.meta.url), 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '');

/** A prompt's one message: each line the agent was asked, then the skill's steps. */
export function prompted(name, asked = []) {
  const said = asked.filter(Boolean);
  return { messages: [{ role: 'user', content: { type: 'text', text: [...said, ...(said.length ? [''] : []), skill(name)].join('\n') } }] };
}
