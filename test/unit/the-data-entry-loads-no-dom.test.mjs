/**
 * `sherpa-ui/data` loads only what the lint holds DOM-free: each export's
 * module, and every module its graph reaches. TRAP T-the-data-entry-loads-no-dom
 *
 *   npm run build && node --test test/unit/the-data-entry-loads-no-dom.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import lint from '../../eslint.config.js';
import { APP, graph } from '../../scripts/check-weight.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Every file a lint block bans `document` in. */
const held = new Set(lint
  .filter((b) => b.rules?.['no-restricted-globals']?.slice(1).some((g) => g.name === 'document'))
  .flatMap((b) => b.files.flatMap((glob) => globSync(glob, { cwd: ROOT }))));
/** What dist/data.js loads, by dist path. */
const loaded = [...graph(`${ROOT}dist/data.js`).modules].map((f) => relative(`${ROOT}dist`, f)).filter((f) => f !== 'data.js');

test('each export of sherpa-ui/data is from a module the lint holds DOM-free', () => {
  const file = ts.createSourceFile('data.ts', readFileSync(`${ROOT}src/data.ts`, 'utf8'), ts.ScriptTarget.Latest);
  const off = [];
  for (const node of file.statements.filter(ts.isExportDeclaration)) {
    assert.ok(node.moduleSpecifier && node.exportClause, 'every export names its module and its names');
    const from = `src/${node.moduleSpecifier.text.slice(2).replace(/\.js$/, '.ts')}`;
    if (!held.has(from)) off.push(...node.exportClause.elements.map((e) => `${e.name.text} from ${from}`));
  }
  assert.deepEqual(off, []);
});

test('everything sherpa-ui/data loads is held DOM-free', () => {
  assert.deepEqual(loaded.map((f) => `src/${f.replace(/\.js$/, '.ts')}`).filter((f) => !held.has(f)), []);
});

test('of the app layer, sherpa-ui/data loads only the app definition', () => {
  assert.deepEqual(loaded.filter((f) => APP.some((a) => f.startsWith(a))), ['core/data/app-definition.js']);
});
