#!/usr/bin/env node
/**
 * check-usage.mjs — a project's markup against the component specs: every
 * `sherpa-*` tag exists, every `data-*` on one is that component's own or one
 * any component carries, and an enum takes the value written. TODO 195.
 * TRAP T-markup-is-checked-against-the-spec
 *
 *   npx sherpa-ui check-usage [folder]     default: the folder it runs in
 *
 * It reads the project's own markup — every `.html` but `node_modules` and `.git`
 * — or the folders `sherpa-usage.json` names, with the project's own hooks:
 *   { "markup": ["app"], "own": { "sherpa-button": ["data-by"] } }
 *
 * Map:
 * - EVERYWHERE — attributes any component may carry: set by an ancestor or a parent, or read by the base class or a helper
 * - markupProblems — every problem in one piece of markup, and how many tags it checked
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

/** Each component's props, by tag, from its spec. */
let specs;
const specsOf = () => {
  specs ??= new Map(globSync('src/components/*/*.component.json', { cwd: UI }).map((f) => {
    const spec = JSON.parse(readFileSync(join(UI, f), 'utf8'));
    return [spec.$name, new Map((spec.props ?? []).map((p) => [p.name, p]))];
  }));
  return specs;
};

/** Every problem in one piece of markup, and how many tags it checked. `own`
 *  names a project's own hooks, by tag. */
export function markupProblems(html, where = 'markup', own = {}) {
  const problems = [];
  let tags = 0;
  // Comments keep their length, so a line number still counts true.
  const code = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  for (const m of code.matchAll(/<(sherpa-[a-z0-9-]+)\b([^>]*)>/g)) {
    const [, tag, attrs] = m;
    const line = code.slice(0, m.index).split('\n').length;
    const props = specsOf().get(tag);
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
  /* A native <button class="sherpa-button"> takes the Button's names: its size
     and type are checked against the Button's spec, and one with no text needs a
     name. Its other data-* are the app's own. TRAP T-a-native-wears-the-button-class */
  const button = specsOf().get('sherpa-button');
  for (const m of code.matchAll(/<button\b([^>]*\bclass="[^"]*\bsherpa-button\b[^"]*"[^>]*)>/g)) {
    const attrs = m[1];
    // The Button's own control: it takes its host's names, and its host's name.
    if (/\spart="[^"]*\btrigger\b/.test(attrs)) continue;
    const line = code.slice(0, m.index).split('\n').length;
    tags++;
    for (const name of ['data-size', 'data-type']) {
      const value = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
      const p = button?.get(name);
      if (value !== undefined && p?.values?.length && !p.values.includes(value)) {
        problems.push(`${where}:${line}  <button class="sherpa-button" ${name}="${value}"> — it takes ${p.values.map((v) => `"${v}"`).join(', ')}`);
      }
    }
    if (/\sdata-type="icon"/.test(attrs) && !/\saria-label(ledby)?="[^"]+"/.test(attrs)) {
      problems.push(`${where}:${line}  <button class="sherpa-button" data-type="icon"> has no aria-label: an icon says nothing to a reader`);
    }
  }
  return { problems, tags };
}

/** Every problem in one project's markup, and how many tags it checked. */
export function usageProblems(project) {
  const config = existsSync(join(project, 'sherpa-usage.json'))
    ? JSON.parse(readFileSync(join(project, 'sherpa-usage.json'), 'utf8')) : {};
  const problems = [];
  let tags = 0;
  // Not what the project installed: the package ships its own templates.
  const skip = (p) => /(^|[\\/])(node_modules|\.git)$/.test(String(p));
  for (const root of config.markup ?? ['.']) {
    for (const file of globSync('**/*.html', { cwd: join(project, root), exclude: skip })) {
      const found = markupProblems(readFileSync(join(project, root, file), 'utf8'), join(root, file), config.own ?? {});
      problems.push(...found.problems);
      tags += found.tags;
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

// By REAL path: run through a linked node_modules/sherpa-ui, the two differ. TRAP T-a-cli-is-run-through-a-link
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(checkUsage(process.argv[2]));
}
