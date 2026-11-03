/**
 * A PICK THAT MATCHES ROWS IS NEVER RULED OUT — TODO 518 (D2). The walk ruled a
 * pick out by its tally of keys, which holds no blank, so a blank read as "no
 * matches" — and 512 then let it go. A pick is ruled out only when its own
 * clause, the filter's own test, matches no row that reaches it.
 *
 *   node --test test/unit/a-pick-that-matches-is-never-ruled-out.test.mjs
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW, onReport } from '../../dist/data.js';

onReport(() => {});
const ROWS = [
  { id: 1, score: 5 }, { id: 2, score: 50 }, { id: 3, score: 90 }, { id: 4, score: null }, { id: 5, score: 7 },
];
const settle = () => new Promise((r) => setTimeout(r, 50));

async function picked(declare, picks) {
  const source = new DataSource({ store: new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' }), limitOptions: true });
  declare(source);
  source.query.ask({ scope: VIEW, hold: ['score'] });
  source.query.ask({ scope: VIEW, field: 'score', reading: { picked: picks } });
  await source.load({ force: true });
  await settle();
  await source.load();
  await settle();
  return { picked: source.query.reading(VIEW, 'score')?.picked, total: source.total };
}

test('a blank picked beside a value keeps its rows', async () => {
  const r = await picked((s) => { s.declareField('score', {}); s.declareValues('score', [null, 5, 7, 50, 90]); }, [null, 5]);
  assert.deepEqual(r, { picked: [null, 5], total: 2 });
});
