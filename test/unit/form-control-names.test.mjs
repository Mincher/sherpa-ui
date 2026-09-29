/**
 * The form controls speak ONE surface — each its own code, the same NAMES, as
 * Will ruled for the component API audit (86): a consumer reaches a checkbox,
 * a radio, a switch and a text field the same way. Read from their specs.
 *
 *   node --test test/unit/form-control-names.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const surface = (name) => {
  const spec = yaml.load(readFileSync(`src/components/${name}/${name}.component.yaml`, 'utf8'));
  const ext = spec.$extensions?.sherpa ?? {};
  return {
    methods: new Set((ext.methods ?? []).map((m) => m.name)),
    props: new Set((ext.jsProps ?? []).map((p) => p.name)),
  };
};

const EVERY = { methods: ['focus', 'checkValidity', 'reportValidity'], props: ['value', 'disabled'] };
const CONTROLS = {
  'sherpa-input-text': [],
  'sherpa-select-checkbox': ['checked'],
  'sherpa-select-radio': ['checked'],
  'sherpa-switch': ['checked'],
};

test('every form control has the same methods and properties', () => {
  for (const [name, extra] of Object.entries(CONTROLS)) {
    const { methods, props } = surface(name);
    for (const m of EVERY.methods) assert.ok(methods.has(m), `${name} has no ${m}()`);
    for (const p of [...EVERY.props, ...extra]) assert.ok(props.has(p), `${name} has no ${p}`);
  }
});
