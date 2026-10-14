#!/usr/bin/env node
/**
 * check-usage.mjs — a project's markup against the component specs: every
 * `sherpa-*` tag exists, every `data-*` on one is that component's own or one
 * any component carries, and an enum takes the value written. TODO 195.
 * TRAP T-markup-is-checked-against-the-spec
 *
 *   npx sherpa-ui check-usage [folder]     default: the folder it runs in
 *
 * The project names its own hooks in `sherpa-usage.json`:
 *   { "markup": ["app"], "own": { "sherpa-button": ["data-by"] } }
 *
 * Map:
 * - EVERYWHERE — attributes any component may carry: set by an ancestor or a parent, or read by the base class or a helper
 * - usageProblems — every problem in one project's markup, and how many tags it checked
 * - checkUsage — check one project and say so; the exit code it should end with
 */
import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = fileURLToPath(new URL('..', import.meta.url));

export const EVERYWHERE = [
  // Set by an ANCESTOR: the token cascades. TRAP T-a-host-attribute-is-declared-once
  'data-status', 'data-look', 'data-elevation', 'data-density', 'data-theme', 'data-mode',
  // Read by the PARENT a component sits in: the layout grid and the stack.
  'data-col-span', 'data-row-span', 'data-min-row-span', 'data-grow',
  // Read by the base class, to ask its provider.
  'data-source', 'data-scope',
  // Read by bindSettings, on any control. TRAP T-a-setting-is-a-pointer
  'data-setting',
];

/** Every problem in one project's markup, and how many tags it checked. */
export function usageProblems(project) {
  const specs = new Map();
  for (const f of globSync('src/components/*/*.component.json', { cwd: UI })) {
    const spec = JSON.parse(readFileSync(join(UI, f), 'utf8'));
    specs.set(spec.$name, new Map((spec.props ?? []).map((p) => [p.name, p])));
  }
  const config = existsSync(join(project, 'sherpa-usage.json'))
    ? JSON.parse(readFileSync(join(project, 'sherpa-usage.json'), 'utf8')) : {};
  const own = config.own ?? {};
  const problems = [];
  let tags = 0;
  for (const root of config.markup ?? ['app']) {
    for (const file of globSync('**/*.html', { cwd: join(project, root) })) {
      const where = join(root, file);
      const html = readFileSync(join(project, root, file), 'utf8');
      // Comments keep their length, so a line number still counts true.
      const code = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
      for (const m of code.matchAll(/<(sherpa-[a-z0-9-]+)\b([^>]*)>/g)) {
        const [, tag, attrs] = m;
        const line = code.slice(0, m.index).split('\n').length;
        const props = specs.get(tag);
        tags++;
        if (!props) {
          problems.push(`${where}:${line}  <${tag}> is no Sherpa component`);
          continue;
        }
        for (const [, name, value] of attrs.matchAll(/\s(data-[\w-]+)(?:="([^"]*)")?/g)) {
          const p = props.get(name);
          if (!p) {
            const placed = /^data-col-span-\d+$/.test(name);
            if (!placed && !EVERYWHERE.includes(name) && !(own[tag] ?? []).includes(name)) {
              problems.push(`${where}:${line}  <${tag} ${name}> — ${tag} has no such attribute`);
            }
            continue;
          }
          if (p.type === 'enum' && value !== undefined && p.values?.length && !p.values.includes(value)) {
            problems.push(`${where}:${line}  <${tag} ${name}="${value}"> — it takes ${p.values.map((v) => `"${v}"`).join(', ')}`);
          }
        }
      }
    }
  }
  return { problems, tags };
}

/** Check one project and say so; the exit code it should end with. An app runs
 *  it on itself — Sherpa knows no app (Will, Q2). */
export function checkUsage(folder = '.') {
  const project = resolve(folder);
  if (!existsSync(project)) {
    console.error(`check-usage: no ${project}`);
    return 1;
  }
  const { problems, tags } = usageProblems(project);
  for (const p of problems) console.error(`  ✗ ${p}`);
  if (problems.length) {
    console.error(`\ncheck-usage: ${problems.length} problem(s). A typo or a renamed attribute does nothing and says nothing.`);
    console.error('Fix the markup, or list a project\'s own hook in its sherpa-usage.json "own".');
    return 1;
  }
  console.log(`check-usage: ${tags} tags in ${project.split('/').at(-1)} match their specs`);
  return 0;
}

// By REAL path: run through a linked node_modules/sherpa-ui, the two differ.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(checkUsage(process.argv[2]));
}
