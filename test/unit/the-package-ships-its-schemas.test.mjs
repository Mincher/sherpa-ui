/**
 * The package ships the schemas a consumer checks a page or a spec against. TODO 184
 *
 *   node --test test/unit/the-package-ships-its-schemas.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// One schema's $ref into another needs both: defs.v1.json is every definition's.
test('npm pack carries every schema', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8' });
  const files = new Set(JSON.parse(out)[0].files.map((f) => f.path));
  const schemas = readdirSync(`${ROOT}schemas`);
  for (const name of ['defs.v1.json', 'page.v1.json', 'app.v1.json', 'views.v1.json', 'entity.v3.json', 'workflow.v3.json', 'component.v1.json', 'pattern.v1.json']) assert.ok(schemas.includes(name), name);
  for (const name of schemas) assert.ok(files.has(`schemas/${name}`), `schemas/${name} is not packed`);
});

test('a schema resolves by the package name', () => {
  const url = import.meta.resolve('sherpa-ui/schemas/page.v1.json');
  assert.equal(fileURLToPath(url), `${ROOT}schemas/page.v1.json`);
});
