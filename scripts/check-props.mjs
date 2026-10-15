#!/usr/bin/env node
/**
 * check-props.mjs — TRAP T-a-host-attribute-is-declared-once.
 *
 * A `:host([data-x])` rule is a PUBLIC API: a host sets it and the component
 * restyles. It must appear in that component's `static props`, so one
 * declaration serves the TS, the CSS and the generated spec.
 *
 * Not flagged, because each is already named somewhere:
 *   inner elements  [data-x] with no :host() — component-private
 *   CASCADES        data-status / data-look / data-elevation: an ANCESTOR
 *                   sets these and any component may read them, so declaring
 *                   one would claim ownership it does not have
 *
 * Also: a component that READS its own `data-*` must declare it. That read is
 * the other half of the same contract — TRAP T-a-host-attribute-is-declared-once.
 * And an OBSERVED `data-*` is declared in `static props`, so `populate()` can
 * set it and the spec types it — but a renamed attribute's old name, the first
 * of an `['data-old', 'data-new']` pair, is still heard and never declared.
 *
 *   node scripts/check-props.mjs
 */
import { readFileSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { parseObserved, parsePropDecls } from './lib/ts-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Set by an ancestor, read by anyone. Owned by the token layer, not a component. */
const CASCADES = new Set(['data-status', 'data-look', 'data-elevation', 'data-density', 'data-theme']);

const problems = [];

/** What a component's TS DECLARES: its `static props` and its `variantAttrs`. */
function declaredIn(ts, path) {
  const declared = new Set(Object.keys(parsePropDecls(ts, path)));
  const variants = /static override variantAttrs = \[([\s\S]*?)\]/.exec(ts);
  if (variants) for (const m of variants[1].matchAll(/'(data-[\w-]+)'/g)) declared.add(m[1]);
  return declared;
}

for (const file of globSync('src/components/*/*.css', { cwd: ROOT })) {
  const comp = file.split('/')[2];
  const css = readFileSync(join(ROOT, file), 'utf8');
  /* The WHOLE file. Everything above `/* == end sherpa:tokens == *\/` is
     Figma's to EDIT, which is why lint:css stops there — but a `:host([data-x])`
     rule in it is still public API, and slicing it off hid `data-size` on
     sherpa-button and `data-state` on sherpa-input-text.
     TRAP T-a-generated-region-still-declares-api */

  let ts;
  try {
    ts = readFileSync(join(ROOT, file.replace(/\.css$/, '.ts')), 'utf8');
  } catch {
    continue;
  }

  // The attributes a :host() selector tests — the component's own surface.
  const hostAttrs = new Set();
  for (const m of css.matchAll(/:host\(([^)]*)\)/g)) {
    for (const a of m[1].matchAll(/\[(data-[\w-]+)/g)) hostAttrs.add(a[1]);
  }

  /* DECLARED, not merely named. Any quoted 'data-x' in the TS once passed, so a
     component that WROTE its own private state as an attribute looked
     declared. Private state is a `:state()`. TRAP T-private-state-is-a-custom-state */
  const declared = declaredIn(ts, join(ROOT, file.replace(/\.css$/, '.ts')));
  for (const attr of [...hostAttrs].sort()) {
    if (CASCADES.has(attr) || declared.has(attr)) continue;
    problems.push(`${relative(ROOT, file)}  :host([${attr}]) is not declared by ${comp} — declare it, or make private state a :state()`);
  }
}

/* The READ half. `this.dataset['x']` is a public attribute arriving, and an
   undeclared one is invisible to the spec and to anything reading it. Only
   `this.dataset` — a local `cal.dataset[...]` is another element's business.
   `variantAttrs` counts as a declaration; `observed` does not, past an old name. */
for (const file of globSync('src/components/*/*.ts', { cwd: ROOT })) {
  const comp = file.split('/')[2];
  const ts = readFileSync(join(ROOT, file), 'utf8');

  const declared = declaredIn(ts, join(ROOT, file));

  for (const attr of parseObserved(ts).filter((a) => a.startsWith('data-') && !declared.has(a))) {
    problems.push(`${relative(ROOT, file)}  observes ${attr} but does not declare it in static props`);
  }

  const seen = new Set();
  const report = (attr, how) => {
    if (declared.has(attr) || seen.has(attr)) return;
    seen.add(attr);
    problems.push(`${relative(ROOT, file)}  reads ${how} for ${attr}, which it does not declare`);
  };
  for (const m of ts.matchAll(/\bthis\.dataset\['(\w+)'\]/g)) {
    report(`data-${m[1].replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`)}`, 'this.dataset');
  }
  /* READS ONLY. `this.hasAttribute('data-locked')` is the same event as reading
     `this.dataset` — a host set it and the component is obeying. A WRITE is not:
     25 components toggle their own transient state this way (`data-copied`,
     `data-resizing`, `data-leaving`), which is internal, not public API.
     TRAP T-a-read-is-public-api-a-write-is-not */
  for (const m of ts.matchAll(/\bthis\.(?:has|get)Attribute\('(data-[\w-]+)'/g)) {
    report(m[1], 'hasAttribute/getAttribute');
  }
}

if (problems.length) {
  console.error(`check-props: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error(
    'A `:host([data-x])` rule is a public API: a host sets the attribute and the\n' +
      'component restyles. Undeclared, it is a contract between the CSS and nothing\n' +
      '— invisible to the TS, to the generated spec and to an agent reading either.\n\n' +
      'Declare it, even when only CSS reads it:\n\n' +
      "    static override props = {\n" +
      "      'data-legend': { type: 'enum', kind: 'style', values: ['horizontal', 'vertical'] },\n" +
      "    } as const;\n\n" +
      '`kind: style` generates no DOM writes — it says the attribute is real.\n' +
      'See T-a-host-attribute-is-declared-once.',
  );
  process.exit(1);
}

console.log('check-props: every :host([data-*]) is declared');
