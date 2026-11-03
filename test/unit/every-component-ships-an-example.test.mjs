/**
 * EVERY COMPONENT SHIPS AN EXAMPLE, beside its spec: it passes the example
 * schema, and its markup passes the usage check. TRAP T-a-component-ships-its-example
 *
 *   node --test test/unit/every-component-ships-an-example.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';
import { markupProblems } from '../../scripts/check-usage.mjs';
import { EXAMPLES } from '../a11y/examples.mjs';

const ROOT = new URL('../../', import.meta.url);
const COMPONENTS = readdirSync(new URL('src/components/', ROOT)).filter((d) => d.startsWith('sherpa-')).sort();

test('every component has one, and the package ships them', () => {
  const missing = COMPONENTS.filter((name) => !existsSync(new URL(`src/components/${name}/${name}.example.json`, ROOT)));
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(EXAMPLES).sort(), COMPONENTS);
  const { files } = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  assert.ok(files.includes('src/components/*/*.example.json'));
});

test('each passes the example schema, and its markup the usage check', () => {
  const valid = schemaCheck('example.v1.json');
  const problems = [];
  for (const name of COMPONENTS) {
    const raw = JSON.parse(readFileSync(new URL(`src/components/${name}/${name}.example.json`, ROOT), 'utf8'));
    problems.push(...valid(raw).map((e) => `${name}: ${e}`));
    const { problems: found, tags } = markupProblems(EXAMPLES[name].html, name);
    problems.push(...found);
    // It shows ITSELF.
    if (!tags || !EXAMPLES[name].html.includes(`<${name}`)) problems.push(`${name}: its example draws no <${name}>`);
  }
  assert.deepEqual(problems, []);
});
