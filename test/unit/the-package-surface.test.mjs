/**
 * One component's import resolves the same way for Node and for TypeScript, and
 * the manifest says what a bundler must keep (TODO 209).
 *
 *   npm run build && node --test test/unit/the-package-surface.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BUTTON = 'sherpa-ui/components/sherpa-button/sherpa-button';

/** Where Node puts an import, or null. */
const inNode = (spec) => {
  try {
    return fileURLToPath(import.meta.resolve(spec));
  } catch {
    return null;
  }
};
/** Where TypeScript finds an import's types, or null. */
const inTypes = (spec, mode) => {
  const options = mode === 'bundler'
    ? { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }
    : { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
  return ts.resolveModuleName(spec, `${ROOT}src/consumer.ts`, options, ts.sys).resolvedModule?.resolvedFileName ?? null;
};

test('one component imported with .js: Node finds the file, TypeScript its types', () => {
  assert.equal(inNode(`${BUTTON}.js`), `${ROOT}dist/components/sherpa-button/sherpa-button.js`);
  for (const mode of ['bundler', 'nodenext']) {
    assert.equal(inTypes(`${BUTTON}.js`, mode), `${ROOT}dist/components/sherpa-button/sherpa-button.d.ts`, mode);
  }
});

test('without .js, Node and TypeScript BOTH refuse it — never types for a file the page cannot load', () => {
  // Node may map it to a path; there is no file there, so its import fails.
  const at = inNode(BUTTON);
  assert.ok(at === null || !existsSync(at), `${BUTTON} loads ${at}`);
  for (const mode of ['bundler', 'nodenext']) assert.equal(inTypes(BUTTON, mode), null, mode);
});

/* The SHORT name, by Will's ruling (TODO 209): `sherpa-ui/components/button`. */
test('one component by its short name: Node finds the file, TypeScript its types', () => {
  assert.equal(inNode('sherpa-ui/components/button'), `${ROOT}dist/components/sherpa-button/sherpa-button.js`);
  assert.equal(inNode('sherpa-ui/components/data-grid'), `${ROOT}dist/components/sherpa-data-grid/sherpa-data-grid.js`);
  for (const mode of ['bundler', 'nodenext']) {
    assert.equal(inTypes('sherpa-ui/components/button', mode), `${ROOT}dist/components/sherpa-button/sherpa-button.d.ts`, mode);
  }
});

test('tools can read the manifest', () => {
  assert.equal(inNode('sherpa-ui/package.json'), `${ROOT}package.json`);
});

test('sideEffects keeps every component module, the entry and the CSS', () => {
  const { sideEffects } = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
  assert.ok(Array.isArray(sideEffects), 'no sideEffects list');
  // A bundler's glob: `**/` is any folders, `*` stays inside one.
  const kept = (file) => sideEffects.some((glob) => new RegExp(`^${glob.replace(/^\.\//, '').replace(/[.]/g, '\\.')
    .replace(/\*\*\//g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '(?:.*/)?')}$`).test(file));
  const components = globSync('dist/components/*/*.js', { cwd: ROOT });
  assert.equal(components.filter((f) => /\/(sherpa-[a-z-]+)\/\1\.js$/.test(f)).length, 65, 'run npm run build');
  for (const file of [...components, 'dist/index.js', 'dist/styles/tokens/tokens.css']) {
    assert.ok(existsSync(`${ROOT}${file}`), `${file} is not built`);
    assert.ok(kept(file), `${file} may be dropped`);
  }
  assert.ok(!kept('dist/data.js'), 'the data layer has no side effects');
});
