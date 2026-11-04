/**
 * THE NODE PANEL'S LIST: each workflow kind has a category, and paletteOf() gives the kinds
 * in category order — never a Query-only kind. A socket of a type is offered the kinds that
 * could join it, a Value first. Will, plan 713 M7, D16.
 *
 *   node --test test/unit/the-node-panel-lists-the-workflow-kinds.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { NODE_KINDS, NODE_CATEGORIES, paletteOf, paletteFor, fitOf } = await import(new URL('../../dist/core/data/node-kinds.js', import.meta.url));

const ids = (palette) => palette.flatMap((g) => g.items.map((i) => i.id));

test('the list is each category with a kind, in order, and Custom Nodes empty', () => {
  const palette = paletteOf(NODE_KINDS);
  assert.deepEqual(palette.map((g) => g.category), ['Sources', 'Custom Nodes', 'Variables', 'Logic', 'Collections', 'Output']);
  assert.deepEqual(palette.map((g) => g.items.map((i) => i.id)), [['store'], [], ['value', 'pick'], ['condition'], ['sort', 'group', 'count'], ['output']]);
  // The order is the list's: each category is where NODE_CATEGORIES puts it.
  const at = palette.map((g) => NODE_CATEGORIES.indexOf(g.category));
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test('no Query-only kind is in it, and each workflow kind is', () => {
  const all = ids(paletteOf(NODE_KINDS));
  for (const [id, kind] of Object.entries(NODE_KINDS)) {
    assert.equal(all.includes(id), kind.graphs.includes('workflow'), id);
    if (kind.graphs.includes('workflow')) assert.ok(kind.category, `${id} has a category`);
  }
  for (const query of ['status', 'source', 'scope', 'preset', 'saved', 'arrange', 'presentation', 'component']) assert.ok(!all.includes(query), query);
});

test("an app's own kind goes after the known categories; one with none is Other", () => {
  const mine = { heading: 'Mine', icon: 'x', rows: [], model: 'mine', graphs: ['workflow'], category: 'Agents' };
  const bare = { heading: 'Bare', icon: 'x', rows: [], model: 'bare', graphs: ['workflow'] };
  const palette = paletteOf({ ...NODE_KINDS, mine, bare });
  assert.deepEqual(palette.slice(-2).map((g) => g.category), ['Agents', 'Other']);
});

test('a socket is offered the kinds that could join it, a Value first', () => {
  const palette = paletteOf(NODE_KINDS);
  // A value output goes into a header or row that takes a value or anything.
  const fromValue = paletteFor(palette, 'value', 'out').map((i) => i.id);
  assert.ok(fromValue.includes('condition') && fromValue.includes('output') && !fromValue.includes('value'));
  // An input that takes a value is fed by a kind that gives one: a Value first.
  const into = paletteFor(palette, 'value', 'in').map((i) => i.id);
  assert.equal(into[0], 'value');
  assert.ok(into.includes('pick') && into.includes('count'));
  // Nothing is fed a boolean but a True, and a Value gives none.
  assert.ok(!paletteFor(palette, 'boolean', 'in').some((i) => i.id === 'value'));
  assert.deepEqual(fitOf(NODE_KINDS['value'], 'value', 'in'), { row: 'value' });
  assert.deepEqual(fitOf(NODE_KINDS['output'], 'object', 'out'), {});
  assert.equal(fitOf(NODE_KINDS['value'], 'value', 'out'), undefined);
});
