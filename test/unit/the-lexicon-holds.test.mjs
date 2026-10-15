/**
 * THE LEXICON HOLDS: no spec brings back a name docs/LEXICON.md retired, and
 * what it unified stays one thing. Read from the generated specs. The held
 * row (input-text's data-state, the Figma `input` mode attribute) is the one
 * entry allowed to differ; it is listed, and may only be removed.
 *
 *   node --test test/unit/the-lexicon-holds.test.mjs
 * TRAP T-a-native-name-where-a-native-element-does-the-job
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const specs = Object.fromEntries(readdirSync('src/components').filter((d) => d.startsWith('sherpa-')).map((name) => [
  name, JSON.parse(readFileSync(`src/components/${name}/${name}.component.json`, 'utf8')),
]));
const propsOf = (n) => new Map((specs[n].props ?? []).map((p) => [p.name, p]));
const slotsOf = (n) => (specs[n].slots ?? []).map((s) => s.name);
const eventsOf = (n) => (specs[n].events ?? []).map((e) => e.name);

/** A name the lexicon retired, per component. */
const GONE_PROPS = {
  'sherpa-gauge-chart': ['data-value', 'data-min', 'data-max'],
  'sherpa-calendar': ['data-value', 'data-min', 'data-max'],
  'sherpa-slider': ['value-start', 'value-end'],
  'sherpa-select-card': ['data-selected'],
  'sherpa-container': ['data-error-message'],
  'sherpa-notifications': ['data-empty-text'],
  'sherpa-file-upload': ['data-helper', 'data-accept', 'data-multiple'],
  'sherpa-select-group': ['data-multiple'],
  'sherpa-prompt-composer': ['data-placeholder'],
};
const GONE_SLOTS = {
  'sherpa-app-header': ['title'], 'sherpa-barchart': ['title'], 'sherpa-gauge-chart': ['title'], 'sherpa-line-chart': ['title'],
  'sherpa-data-viz-header': ['left'], 'sherpa-nav': ['brand-icon'], 'sherpa-empty-state': ['action'],
};

test('a retired attribute is in no spec', () => {
  const back = Object.entries(GONE_PROPS).flatMap(([n, names]) => names.filter((a) => propsOf(n).has(a)).map((a) => `${n} ${a}`));
  assert.deepEqual(back, []);
});

test('a retired slot is in no spec, and no slot is called title or action', () => {
  const back = Object.entries(GONE_SLOTS).flatMap(([n, names]) => names.filter((s) => slotsOf(n).includes(s)).map((s) => `${n} ${s}`));
  assert.deepEqual(back, []);
  const odd = Object.keys(specs).flatMap((n) => slotsOf(n).filter((s) => s === 'title' || s === 'action').map((s) => `${n} ${s}`));
  assert.deepEqual(odd, []);
});

test('dismissing is -dismiss, and data-dismissible is a boolean', () => {
  assert.ok(!eventsOf('sherpa-chip').includes('chip-remove') && eventsOf('sherpa-chip').includes('chip-dismiss'));
  assert.ok(!eventsOf('sherpa-tag').includes('tag-remove') && eventsOf('sherpa-tag').includes('tag-dismiss'));
  for (const n of Object.keys(specs)) {
    const p = propsOf(n).get('data-dismissible');
    if (p) assert.equal(p.type, 'boolean', `${n} data-dismissible is ${p.type}`);
  }
});

test('the ticked controls take checked, and the padding is one scale', () => {
  for (const n of ['sherpa-select-card', 'sherpa-select-checkbox', 'sherpa-select-radio', 'sherpa-switch']) {
    const js = (specs[n].$extensions?.sherpa?.jsProps ?? []).map((p) => p.name);
    assert.ok(js.includes('checked'), `${n} has no checked`);
    assert.ok(!js.includes('selected'), `${n} still has selected`);
  }
  const pad = propsOf('sherpa-container');
  assert.deepEqual(pad.get('data-padding').values, pad.get('data-padding-inline').values);
});

test('a native name is unprefixed, where a native element does the job', () => {
  for (const [n, names] of [['sherpa-gauge-chart', ['value', 'min', 'max']], ['sherpa-calendar', ['value', 'min', 'max']],
    ['sherpa-file-upload', ['accept', 'multiple']], ['sherpa-select-group', ['multiple']], ['sherpa-prompt-composer', ['placeholder']]]) {
    for (const a of names) assert.ok(propsOf(n).has(a), `${n} has no ${a}`);
  }
  // A range's ends have no native name: both components, one spelling.
  for (const n of ['sherpa-slider', 'sherpa-calendar']) {
    assert.ok(propsOf(n).has('data-value-start') && propsOf(n).has('data-value-end'), `${n} ends`);
  }
});

test('the held row is the only difference left: input-text data-state', () => {
  assert.ok(propsOf('sherpa-input-text').has('data-state'));
});
