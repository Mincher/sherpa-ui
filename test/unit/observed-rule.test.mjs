/**
 * The base class observes what it does work for, and a component the rest it
 * lists: a spec's `observed` says the same, by the same rule, and the vendored
 * generator's copy of the rule names the same props. TRAP T-observe-what-does-work
 *
 *   node --test test/unit/observed-rule.test.mjs   (imports dist/: build first)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync } from 'node:fs';
import { baseObserves } from '../../scripts/lib/ts-facts.mjs';
import { ASKED } from '../../scripts/lib/generation/compile-def.mjs';

const ROOT = new URL('../../', import.meta.url);

test('each class observes exactly what its spec says', async () => {
  await import(new URL('dist/components.js', ROOT).href);
  const { defined } = await import(new URL('dist/core/ui/sherpa-element.js', ROOT).href);
  const wrong = [];
  for (const file of globSync('src/components/*/*.component.json', { cwd: ROOT })) {
    const spec = JSON.parse(readFileSync(new URL(file, ROOT), 'utf8'));
    const cls = defined().get(spec.$name);
    if (!cls) continue;
    const heard = new Set(cls.observedAttributes);
    for (const p of spec.props ?? []) {
      if (p.declared && p.observed !== heard.has(p.name)) wrong.push(`${spec.$name} ${p.name}: spec ${p.observed}, class ${heard.has(p.name)}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('the generator’s copy of the rule asks by the props the base class does', () => {
  const src = readFileSync(new URL('src/core/ui/sherpa-element.ts', ROOT), 'utf8');
  const keys = (name) => [...new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const`).exec(src)[1].matchAll(/^\s*'(data-[\w-]+)':/gm)].map((m) => m[1]);
  const asked = [...keys('SUMMARY_PROPS'), ...keys('STACK_PROPS'), 'data-source', 'data-scope'];
  assert.deepEqual([...ASKED].sort(), [...asked].sort());
  for (const name of asked) assert.equal(baseObserves(name, { kind: 'style', type: 'string' }), true, name);
  assert.equal(baseObserves('data-align', { kind: 'style', type: 'enum' }), false);
  assert.equal(baseObserves('data-wrap', { kind: 'style', type: 'boolean' }), true);
});
