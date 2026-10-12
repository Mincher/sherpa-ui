/**
 * Every module in dist/ imports in bare Node — no DOM, no stubs — so a server
 * (Next.js, Nuxt, Angular SSR, SvelteKit) can import a component; and `define()`
 * registers a tag once, saying when another class holds it (TODO 207).
 * TRAP T-a-component-imports-anywhere
 *
 *   npm run build && node --test test/unit/import-anywhere.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

test('every module in dist/ imports with no DOM', async () => {
  const files = globSync('dist/**/*.js');
  assert.ok(files.length > 100, `only ${files.length} files — run npm run build`);
  const failed = [];
  for (const file of files) {
    try {
      await import(pathToFileURL(file).href);
    } catch (error) {
      failed.push(`${file}: ${error.message}`);
    }
  }
  assert.deepEqual(failed, []);
});

test('define() registers once, and says when another class holds the tag', async () => {
  const defined = new Map();
  globalThis.customElements = {
    get: (tag) => defined.get(tag),
    define: (tag, cls) => {
      if (defined.has(tag)) throw new Error(`${tag} defined twice`);
      defined.set(tag, cls);
    },
  };
  try {
    const { define, onReport } = await import(pathToFileURL('dist/index.js').href);
    const heard = [];
    const stop = onReport((issue) => heard.push(issue.code));
    class One {}
    class Two {}
    define('sherpa-probe', One);
    define('sherpa-probe', One);
    define('sherpa-probe', Two);
    stop();
    assert.equal(defined.get('sherpa-probe'), One);
    assert.deepEqual(heard, ['tag-taken']);
  } finally {
    delete globalThis.customElements;
  }
});
