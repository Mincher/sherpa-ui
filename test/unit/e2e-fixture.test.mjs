/**
 * Every e2e spec takes `test` from ./fixture or ./harness, whose page parks the
 * pointer after every goto, and parks it on any page it opens itself (TODO 203).
 * TRAP T-chromium-pointer-starts-on-the-page
 *
 *   node --test test/unit/e2e-fixture.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const E2E = new URL('../e2e/', import.meta.url);
const specs = async () => {
  const files = (await readdir(E2E)).filter((f) => f.endsWith('.spec.ts'));
  assert.ok(files.length > 100, 'no specs found');
  return Promise.all(files.map(async (f) => [f, await readFile(new URL(f, E2E), 'utf8')]));
};

test('every spec takes test from ./fixture or ./harness, never from @playwright/test', async () => {
  for (const [file, src] of await specs()) {
    assert.match(src, /^import \{[^}]*\btest\b[^}]*\} from '\.\/(?:fixture|harness)';$/m, `${file}: import test from './fixture' or './harness'`);
    assert.doesNotMatch(src, /^import \{[^}]*\btest\b[^}]*\} from '@playwright\/test'/m, `${file}: test comes from @playwright/test`);
  }
});

test('every page a spec opens itself goes through parkThePointer', async () => {
  for (const [file, src] of await specs()) {
    for (const line of src.split('\n').filter((l) => /\.newPage\(\)/.test(l))) {
      assert.match(line, /parkThePointer\(/, `${file}: ${line.trim()}`);
    }
  }
});
