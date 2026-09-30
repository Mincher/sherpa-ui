/**
 * WHERE A FILTER WENT, in words — TODO 126. One sentence for a chip's tooltip
 * and a panel's note. TRAP T-an-inactive-chip-says-where-its-filter-went
 *
 *   node --test test/unit/moved-to.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { movedTo } = await import(new URL('../../dist/core/ui/shared-constants.js', import.meta.url));

test('movedTo names the scope; a heading that ends in "filters" says "scope" once', () => {
  assert.equal(movedTo('View filters'), 'Filter moved to View scope.');
  assert.equal(movedTo('Customer records'), 'Filter moved to Customer records scope.');
  assert.equal(movedTo(''), 'Filter moved to a higher scope.');
  assert.equal(movedTo(undefined), 'Filter moved to a higher scope.');
});
