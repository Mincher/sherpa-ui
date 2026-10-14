/**
 * Every event a component EMITS is in its spec, and its name is one the type
 * checker can read — a variable is named by its narrowed type. An event it
 * dispatches on ANOTHER element is not its own. TRAP T-an-event-name-is-not-always-a-literal
 *
 *   node --test test/unit/every-emitted-event-is-in-its-spec.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEmits } from '../../scripts/lib/ts-facts.mjs';

const NAMES = readdirSync('src/components').filter((n) => existsSync(`src/components/${n}/${n}.ts`));
const specEvents = (name) => new Set((JSON.parse(readFileSync(`src/components/${name}/${name}.component.json`, 'utf8')).events ?? [])
  .map((e) => e.name));

test('every emit() names its event in a way the checker reads', () => {
  const unread = NAMES.flatMap((n) => parseEmits(resolve(`src/components/${n}/${n}.ts`)).unread);
  assert.deepEqual(unread, []);
});

test('every emitted event is in its component\'s spec', () => {
  const missing = NAMES.flatMap((n) => {
    const listed = specEvents(n);
    return [...parseEmits(resolve(`src/components/${n}/${n}.ts`)).details.keys()]
      .filter((e) => !listed.has(e)).map((e) => `${n} ${e}`);
  });
  assert.deepEqual(missing, []);
});

test('a save emitted through a variable is named, and a click dispatched on a child is not the bar\'s', () => {
  const bar = specEvents('sherpa-quick-filter-toolbar');
  const panel = specEvents('sherpa-filter-panel');
  assert.ok(bar.has('filters-save') && bar.has('filters-save-as'));
  assert.ok(panel.has('filters-save-as'));
  assert.ok(!bar.has('button-click') && !panel.has('button-click') && !panel.has('menu-change'));
});
