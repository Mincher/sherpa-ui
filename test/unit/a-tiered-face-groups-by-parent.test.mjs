/**
 * A TIERED FACE GROUPS BY PARENT — TODO 369, Will's Q3. A Customer picked whole
 * reads as its name; one with some Sites picked reads "Northwind: London,
 * Leeds"; a Site under a picked Customer adds nothing. The face reads only the
 * values and their parents — a chip knows those, and not the child's field.
 *
 *   node --test test/unit/a-tiered-face-groups-by-parent.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fieldState, filterFace } from '../../dist/data.js';

const P = (c, s) => `{customer:${c},site:${s}}`;
const VALUES = ['Contoso', P('Contoso', 'London'), 'Northwind', P('Northwind', 'Leeds'), P('Northwind', 'London'), 'Tailspin'];
const LABELS = { [P('Contoso', 'London')]: 'London', [P('Northwind', 'Leeds')]: 'Leeds', [P('Northwind', 'London')]: 'London' };
const PARENT_OF = new Map(VALUES.filter((v) => v.startsWith('{')).map((v) => [v, v.slice(10, v.indexOf(','))]));
const face = (picked) => filterFace(fieldState({ field: 'customer', values: VALUES, labels: LABELS, parentOf: PARENT_OF }, { picked }));

test('a customer whole reads as its name', () => {
  assert.equal(face(['Contoso']).tip, 'Contoso');
});

test('a customer with some sites reads "Northwind: Leeds, London"', () => {
  const f = face([P('Northwind', 'Leeds'), P('Northwind', 'London')]);
  assert.equal(f.tip, 'Northwind: Leeds, London');
  assert.equal(f.value, 'Northwind: Leeds, London');
});

test('both, in the tree\'s order: "Contoso, Northwind: London"', () => {
  const f = face([P('Northwind', 'London'), 'Contoso']);
  assert.equal(f.tip, 'Contoso, Northwind: London');
  assert.equal(f.value, 'Contoso…');
  assert.equal(f.current, true);
});

test('a site under a picked customer adds nothing', () => {
  assert.equal(face(['Northwind', P('Northwind', 'Leeds')]).tip, 'Northwind');
});
