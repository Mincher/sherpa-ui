/**
 * A GRID IS NEVER WIRED BY HAND — Will, TODO 388. A data grid bound with no
 * provider is reported; the provider's own bind (it passes `deliver`) is not,
 * and nor is any other component.
 *
 *   node --test test/unit/a-grid-is-never-wired-by-hand.test.mjs
 *
 * TRAP T-a-grid-is-never-wired-by-hand
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, onReport } from '../../dist/data.js';

const fake = (localName) => ({
  localName, id: 'g', populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
});

test('a grid bound by hand is reported; the provider\'s bind and other components are not', () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1 }], { key: 'id' }) });
  const codes = [];
  const stop = onReport((r) => codes.push([r.code, r.at?.id]));
  bindSource(source, fake('sherpa-data-grid'));
  bindSource(source, fake('sherpa-data-grid'), { deliver() {} });
  bindSource(source, fake('sherpa-barchart'), { readonly: true });
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} });
  stop();
  assert.deepEqual(codes, [['grid-without-provider', 'g']]);
});
