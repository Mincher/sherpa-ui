/**
 * The package ships the schemas a consumer checks a page or a spec against. TODO 184
 *
 *   node --test test/unit/the-package-ships-its-schemas.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('npm pack carries both schemas', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8' });
  const files = new Set(JSON.parse(out)[0].files.map((f) => f.path));
  for (const name of ['schemas/page.v1.json', 'schemas/component.v1.json']) assert.ok(files.has(name), `${name} is not packed`);
});

test('a schema resolves by the package name', () => {
  const url = import.meta.resolve('sherpa-ui/schemas/page.v1.json');
  assert.equal(fileURLToPath(url), `${ROOT}schemas/page.v1.json`);
});
