/**
 * A VALUE IS TYPED ONCE, by its field, where it comes in: a reader's `70` typed in
 * a number's menu, a host's `['storage', 'gt', 70]`, a definition's `{ gt: "70" }`
 * and a preset's are one tree, and the compile casts nothing.
 * TRAP T-a-value-is-typed-once
 *
 *   node --test test/unit/a-value-is-typed-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, answerTree, conditionClause, filterCondition, openSource, readingClause, readingsOf,
  treeReading, typedValue,
} from '../../dist/data.js';

const number = () => ({ type: 'number' });
const bare = ({ field: _field, ...leaf }) => leaf;

test('a typed gt 70 and a host-set one are the same tree, and compile alike', () => {
  const host = bare(filterCondition(['storage', 'gt', 70]));
  // A reader's ` 70 ` typed in a number's menu: its row's leaf, typed as it comes in.
  const typed = { op: 'gt', value: typedValue('number', ' 70 ') };
  assert.deepEqual(typed, { op: 'gt', value: 70 });
  assert.deepEqual(typed, host);
  // A host's clause on a number column, as a heading holds it: its answer is the same tree.
  assert.deepEqual(answerTree(treeReading(filterCondition(['storage', 'gt', 70]), 'number'), number()), host);
  // A definition that wrote it as text, and the plain form's number.
  assert.deepEqual(readingsOf({ storage: { or: [{ gt: '70' }, { lt: 5 }] } }, number).storage.tree,
    { or: [{ op: 'gt', value: 70 }, { op: 'lt', value: 5 }] });
  for (const tree of [typed, host]) {
    assert.deepEqual(readingClause({ field: 'storage', type: 'number' }, { tree }), ['storage', 'gt', 70]);
  }
});

test('typedValue: a number field\'s text is its number; a list each; anything else as given', () => {
  assert.equal(typedValue('number', ' 70 '), 70);
  assert.deepEqual(typedValue('number', ['1', 2, 'n/a']), [1, 2, 'n/a']);
  assert.equal(typedValue('number', ''), '');
  assert.equal(typedValue('number', null), null);
  assert.equal(typedValue('text', '70'), '70');
  assert.equal(typedValue('date', '2026-11-03'), '2026-11-03');
  // A list op's picks and a range's ends, typed as each row comes in.
  assert.deepEqual(typedValue('number', ['5', '9']), [5, 9]);
  assert.deepEqual(typedValue('number', ['10', '60']), [10, 60]);
  // A text field keeps what was typed.
  assert.equal(typedValue(undefined, '70'), '70');
});

test('the compile casts nothing: a tree is compiled as it holds its values', () => {
  assert.deepEqual(conditionClause({ op: 'gt', value: '70' }, { field: 'storage', type: 'number' }), ['storage', 'gt', '70']);
});

test('a preset from a definition holds its tree typed: a number\'s 60, a date\'s two ends a range', async () => {
  const rows = [{ id: 1, score: 50, created: '2026-10-02' }, { id: 2, score: 70, created: '2026-12-01' }];
  const source = await openSource({
    store: 'rows',
    fields: { score: { type: 'number' }, created: { type: 'date', range: true } },
    scopes: { data: { offers: 'all', presets: [
      { id: 'low', label: 'Low', where: { score: { lt: 60 } } },
      { id: 'autumn', label: 'Autumn', where: { created: { between: ['2026-09-01', '2026-11-30'] } } },
    ] } },
  }, new ArrayStore(rows, { key: 'id' }));
  const [low, autumn] = source.query.presets('data');
  assert.deepEqual(low.readings, { score: { tree: { op: 'lt', value: 60 } } });
  assert.deepEqual(autumn.readings, { created: { tree: { op: 'between', value: ['2026-09-01', '2026-11-30'] } } });
  source.query.ask({ scope: 'data', preset: 'low', on: true, commit: true });
  assert.deepEqual(source.query.applied.scopes.data.readings.score.byPreset.low.tree, { op: 'lt', value: 60 });
  assert.deepEqual(source.whereOf(source.query.applied.scopes.data.readings), { score: { lt: 60 } });
});
