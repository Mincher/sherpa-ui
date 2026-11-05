/** The primary modifier: Cmd on Apple platforms, Ctrl elsewhere; a Mac's plain Ctrl does not count. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { primaryKey } = await import(new URL('../../dist/core/ui/modifier-key.js', import.meta.url));

test('Cmd counts on a Mac and Ctrl does not; elsewhere Ctrl counts and Cmd does not', () => {
  assert.equal(primaryKey({ ctrlKey: false, metaKey: true }, true), true);
  assert.equal(primaryKey({ ctrlKey: true, metaKey: false }, true), false);
  assert.equal(primaryKey({ ctrlKey: true, metaKey: false }, false), true);
  assert.equal(primaryKey({ ctrlKey: false, metaKey: true }, false), false);
});
