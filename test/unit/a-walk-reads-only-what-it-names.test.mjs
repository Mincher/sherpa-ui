/**
 * A WALK READS ONLY WHAT IT NAMES — 345 phase 3. `walkReads` names the fields a
 * walk tests and tallies; a change to any other field leaves the walk as it is,
 * and a saved filter that is off, and counts nothing, reads no row at all.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/a-walk-reads-only-what-it-names.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { walkInOrder, walkReads } from '../../dist/core/data/walk.js';
import { planWalk } from '../../dist/core/data/source-counts.js';

const ROWS = (() => {
  let seed = 345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const of = (list) => list[Math.floor(rnd() * list.length)];
  return Array.from({ length: 600 }, (_, i) => ({
    id: i, customer: of(['Contoso', 'Tailspin', 'Litware', 'Fabrikam']), region: of(['EMEA', 'AMER', 'APAC']),
    status: of(['active', 'trial', 'churned']), plan: of(['free', 'pro']), tier: of(['bronze', 'silver', 'gold']),
    seats: Math.floor(rnd() * 500), health: Math.floor(rnd() * 101), lastSeen: `2025-0${1 + Math.floor(rnd() * 9)}-10`,
  }));
})();
const LIST = new Set(['customer', 'region', 'status', 'plan', 'tier']);
const PRESETS = { 'free-plan': { plan: { picked: ['free'] } }, gold: { tier: { picked: ['gold'] } } };

const facts = (over = {}) => ({
  field: (f) => (f === 'seats' || f === 'health' ? { type: 'number' } : {}),
  isList: (f) => LIST.has(f), plainPicks: () => true, presets: (id) => PRESETS[id], sets: () => [],
  fields: (scope) => (scope === 'view' ? ['customer', 'region'] : ['status', 'tier']),
  components: new Set(['data']), fixed: new Set(), parts: [], narrowing: new Map(),
  limit: true, now: new Date('2026-10-20T00:00:00Z'), ...over,
});
const query = (extra = {}) => ({ v: 1, scopes: {
  view: { holds: ['customer', 'region'], readings: { region: { picked: ['EMEA', 'APAC'] } } },
  data: { holds: ['status', 'tier'], readings: { status: { picked: ['active'] } }, presets: { 'free-plan': false, gold: true } },
  ...extra,
} });

/** Every plan the walk can be given: Limit on and off, a part, a hand filter, a chart part, a component's own scope. */
const PLANS = {
  limit: planWalk(query(), facts()),
  'limit off': planWalk(query(), facts({ limit: false })),
  part: planWalk(query(), facts({ parts: [['seats', 'lt', 400]] })),
  hand: planWalk({ v: 1, scopes: { view: { holds: [], readings: {} } } }, facts({ hand: ['seats', 'gt', 100] })),
  'chart part': planWalk(query({ legend: { holds: [], readings: { status: { picked: ['trial'] } }, narrows: ['chart'] } }),
    facts({ narrowing: new Map([['legend', { field: 'status', host: 'data' }]]) })),
  'own scope': planWalk(query({ own: { holds: [], readings: { tier: { picked: ['silver'] } } } }),
    facts({ components: new Set(['data', 'own']), fixed: new Set(['own']) })),
};

const readsOf = (plan) => new Set(Object.values(walkReads(plan)).flatMap((r) => [...r.tested, ...r.tallied]));

test('walkReads names what each scope tests and tallies — an off saved filter is not among them', () => {
  const on = walkReads(PLANS.limit);
  assert.deepEqual(on.view, { tested: ['region'], tallied: ['customer', 'region'] });
  assert.deepEqual({ tested: [...on.data.tested].sort(), tallied: [...on.data.tallied].sort() },
    { tested: ['status', 'tier'], tallied: ['status', 'tier'] });
  // Limit off: the View rules nothing, so it tallies nothing.
  assert.deepEqual(walkReads(PLANS['limit off']).view.tallied, []);
});

test('a change to a field the walk does not read leaves the walk as it is', () => {
  const fields = Object.keys(ROWS[0]).filter((f) => f !== 'id');
  let tried = 0;
  for (const [name, plan] of Object.entries(PLANS)) {
    const reads = readsOf(plan);
    const before = walkInOrder(ROWS, plan);
    for (const f of fields) {
      // One row in five moves.
      const moved = ROWS.map((r) => (r.id % 5 ? r : { ...r, [f]: typeof r[f] === 'number' ? -1 - r[f] : `moved ${r[f]}` }));
      const after = walkInOrder(moved, plan);
      if (!reads.has(f)) {
        tried++;
        assert.deepEqual(after, before, `${name}: ${f} is not read, yet the walk moved`);
      }
    }
  }
  assert.ok(tried >= 12, `only ${tried} unread fields tried`);
  // …and the check has teeth: a field it reads does move it.
  const moved = ROWS.map((r) => (r.id % 5 ? r : { ...r, region: 'LATAM' }));
  assert.notDeepEqual(walkInOrder(moved, PLANS.limit), walkInOrder(ROWS, PLANS.limit));
});

test('a saved filter that is off and counts nothing reads no row', () => {
  let reads = 0;
  const rows = ROWS.map((r) => {
    const { plan, ...rest } = r;
    return Object.defineProperty(rest, 'plan', { get: () => { reads++; return plan; }, enumerable: true });
  });
  walkInOrder(rows, PLANS.limit);
  assert.equal(reads, 0);
  // On, it does: each row the View leaves it.
  walkInOrder(rows, planWalk(query({ data: { holds: ['status'], readings: {}, presets: { 'free-plan': true } } }), facts()));
  assert.ok(reads > 100, `${reads} reads`);
});
