/**
 * THE WALK — TODOs 347–349, alone: the one order of a scope's answers, and one
 * ordered pass that gives every count, value count, grey, set-aside and serial
 * offer. Pure: plain rows and a plan, no source. TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/filters-limit-in-order.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore } from '../../dist/data.js';
import { walkInOrder } from '../../dist/core/data/walk.js';
import { answerOrder, planWalk, walkStepwise } from '../../dist/core/data/source-counts.js';
import { absoluteDates, matchesFilter, readField, valueKey } from '../../dist/core/data/store.js';

/** The customers each region holds — `present-limits-each-field`'s ten rows. */
const REGION_ORGS = {
  EMEA: ['Contoso', 'Adventure Works'],
  AMER: ['Contoso', 'Adventure Works', 'Tailspin'],
  APAC: ['Contoso', 'Adventure Works', 'Litware'],
  LATAM: ['Contoso', 'Tailspin'],
};
const ROWS = Object.entries(REGION_ORGS).flatMap(([region, orgs]) =>
  orgs.map((customer) => ({ region, customer, status: customer === 'Litware' ? 'trial' : 'active' })))
  .map((r, id) => ({ id, seats: id * 3, ...r }));
const LISTS = new Set(['region', 'customer', 'status']);

/** A source's facts, by hand: list fields, plain picks, no saved filter. */
function facts(over = {}) {
  return {
    field: () => ({}),
    isList: (f) => LISTS.has(f),
    plainPicks: (_f, r) => (r.mode ?? 'simple') === 'simple' && !r.range && (r.op ?? 'eq') === 'eq',
    presets: () => undefined,
    sets: () => [],
    fields: (scope) => (scope === 'view' ? ['customer', 'region', 'status'] : scope === 'data' ? ['status', 'customer'] : []),
    components: new Set(['data']),
    fixed: new Set(),
    parts: [],
    narrowing: new Map(),
    limit: true,
    now: new Date('2026-10-19T12:00:00Z'),
    ...over,
  };
}
const query = (scopes) => ({ v: 1, scopes });
const walk = (q, over) => walkInOrder(ROWS, planWalk(q, facts(over)));

test('the order: saved filters first, a set gathered where it starts, an unheld reading last, chain marks', () => {
  const q = query({
    view: { holds: ['status', 'region', 'seats', 'customer'], readings: { id: { picked: [1] } }, presets: { b: true, a: false } },
    data: { holds: ['customer', 'status'], readings: {} },
  });
  const sets = [{ id: 'acct', mode: 'serial', fields: ['customer', 'region'] }];
  const order = answerOrder(q, sets, (id) => (id === 'b' ? {} : undefined), 'view');
  assert.deepEqual(order.map((e) => e.id), ['b', 'a', 'status', 'customer', 'region', 'seats', 'id']);
  assert.deepEqual(order.slice(0, 2).map((e) => e.known), [true, false]);
  assert.deepEqual(order.filter((e) => e.chain).map((e) => [e.id, e.chain]), [['customer', 'top'], ['region', 'below']]);
  assert.equal(order.find((e) => e.id === 'id').held, false);
  // Below the View, a field the View holds is marked above, and out of any chain.
  const data = answerOrder(q, sets, () => undefined, 'data');
  assert.deepEqual(data.map((e) => [e.id, e.above]), [['customer', true], ['status', true]]);
});

test('a chip counts within the filters BEFORE it; the last in force is the total', () => {
  const q = query({ view: { holds: ['region', 'customer'], readings: { region: { picked: ['AMER', 'APAC'] }, customer: { picked: ['Contoso'] } } } });
  const w = walk(q);
  assert.deepEqual(w.results.view, { region: 6, customer: 2 });
  assert.equal(w.ends.view, 2);
  // The other order: Customer first counts over every row.
  const back = walk(query({ view: { ...q.scopes.view, holds: ['customer', 'region'] } }));
  assert.deepEqual(back.results.view, { customer: 4, region: 2 });
});

test('OFF counts what it would match within the filters before it, and narrows nothing', () => {
  const q = query({ view: { holds: ['region', 'customer'], readings: { region: { picked: ['EMEA'], suspended: true }, customer: { picked: ['Contoso'] } } } });
  const w = walk(q);
  assert.deepEqual(w.results.view, { region: 2, customer: 4 });
  assert.equal(w.ends.view, 4);
  // An OFF pick is never set aside.
  assert.deepEqual(w.aside.view, {});
});

test('a saved filter ON narrows what follows; OFF it has no badge', () => {
  const presets = (id) => (id === 'trials' ? { status: { picked: ['trial'] } } : undefined);
  const on = walk(query({ view: { holds: ['customer'], readings: { customer: { picked: ['Litware', 'Contoso'] } }, presets: { trials: true } } }), { presets });
  assert.deepEqual(on.results.view, { trials: 1, customer: 1 });
  const off = walk(query({ view: { holds: ['customer'], readings: { customer: { picked: ['Litware', 'Contoso'] } }, presets: { trials: false } } }), { presets });
  assert.deepEqual(off.results.view, { customer: 5 });
});

test('Limit on: an earlier pick limits a later field, never the other way', () => {
  // AW, then LATAM: LATAM has no AW row, so LATAM is set aside — AW stands.
  const q = query({ view: { holds: ['customer', 'region'], readings: { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } } } });
  const w = walk(q);
  assert.deepEqual(w.aside.view, { region: ['LATAM'] });
  assert.deepEqual(w.present.view.customer.sort(), ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
  assert.deepEqual(w.present.view.region.sort(), ['AMER', 'APAC', 'EMEA']);
  assert.deepEqual(w.results.view, { customer: 3, region: 1 });
  assert.equal(w.ends.view, 1);
  // Every pick ruled out: the field narrows nothing and wears no badge.
  const all = walk(query({ view: { ...q.scopes.view, readings: { ...q.scopes.view.readings, region: { picked: ['LATAM'] } } } }));
  assert.deepEqual(all.aside.view, { region: ['LATAM'] });
  assert.deepEqual(all.results.view, { customer: 3 });
  assert.equal(all.ends.view, 3);
});

test('a set-aside is exact under loose matching: the rows are scanned again with what is left', () => {
  // "emea" matches EMEA rows loosely, but is not a value key the rows hold: set aside.
  const q = query({ view: { holds: ['region'], readings: { region: { picked: ['emea', 'APAC'] } } } });
  const w = walk(q);
  assert.deepEqual(w.aside.view, { region: ['emea'] });
  assert.equal(w.ends.view, 3);
  assert.deepEqual(w.results.view, { region: 3 });
});

test('Limit off: the View limits nothing; a component scope is ruled by the View\'s end', () => {
  const q = query({
    view: { holds: ['customer'], readings: { customer: { picked: ['Litware'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['active', 'trial'] } } },
  });
  const w = walk(q, { limit: false });
  assert.deepEqual(w.present.view, {});
  assert.deepEqual(w.present.data.status, ['trial']);
  // A pick the View leaves no row for is set aside in the component scope.
  assert.deepEqual(w.aside.data, { status: ['active'] });
  assert.equal(w.ends.data, 1);
});

test('a serial set\'s lower field offers only what the rows at its place hold, once something before narrows', () => {
  const sets = () => [{ id: 'acct', mode: 'serial', fields: ['customer', 'region'] }];
  const q = query({ view: { holds: ['customer', 'region'], readings: { customer: { picked: ['Litware'] } } } });
  const w = walk(q, { sets, limit: false });
  assert.deepEqual(w.offered.view, { region: ['APAC'] });
  // Nothing before it narrows: it offers everything, so it is not cut.
  const open = walk(query({ view: { holds: ['customer', 'region'], readings: {} } }), { sets, limit: false });
  assert.deepEqual(open.offered.view, {});
  // A component scope's chain starts inside the View: the View narrowed, so the lower field offers.
  const data = walk(query({
    view: { holds: ['region'], readings: { region: { picked: ['LATAM'] } } },
    data: { holds: ['status', 'customer'], readings: {} },
  }), { sets: (s) => (s === 'data' ? [{ id: 'x', mode: 'serial', fields: ['status', 'customer'] }] : []), limit: false });
  assert.deepEqual(data.offered.data.customer.sort(), ['Contoso', 'Tailspin']);
});

test('a field no chip holds is tapped where it would stand; one with nothing left is spent', () => {
  const q = query({ view: { holds: ['region'], readings: { region: { picked: ['LATAM'] } } } });
  const w = walk(q, { fields: () => ['region', 'customer', 'status'] });
  assert.deepEqual(w.present.view.customer.sort(), ['Contoso', 'Tailspin']);
  assert.deepEqual(w.present.view.status, ['active']);
  assert.deepEqual(w.spent.view, []);
  const none = walk(query({ view: { holds: ['customer'], readings: { customer: { picked: ['Litware'] } } } }), {
    fields: () => ['customer', 'missing'], isList: () => true,
  });
  assert.deepEqual(none.spent.view, ['missing']);
});

test('each picked value counts its own rows, within the filters before it', () => {
  const q = query({ view: { holds: ['region', 'customer'], readings: { region: { picked: ['AMER'] }, customer: { picked: ['Contoso', 'Tailspin', 'Litware'] } } } });
  const w = walk(q);
  assert.deepEqual(w.values.view, { region: { AMER: 3 }, customer: { Contoso: 1, Tailspin: 1, Litware: 0 } });
});

test('a relative date is read at the plan\'s moment, made absolute once', () => {
  const rows = [{ id: 1, when: '2026-10-10' }, { id: 2, when: '2026-08-01' }];
  const plan = { now: new Date('2026-10-19T12:00:00Z'), scopes: [{
    scope: 'view', after: null, taps: [], setsAside: true,
    steps: [{ id: 'when', field: 'when', clause: ['when', 'last', { n: 30, unit: 'day' }], on: true, counts: true }],
  }] };
  assert.deepEqual(walkInOrder(rows, plan).results.view, { when: 1 });
  assert.deepEqual(walkInOrder(rows, { ...plan, now: new Date('2026-08-15T12:00:00Z') }).results.view, { when: 1 });
  assert.equal(walkInOrder(rows, { ...plan, now: new Date('2027-01-01T12:00:00Z') }).ends.view, 0);
});

test('the parts and the page\'s own scopes are the View\'s base: every chip counts within them', () => {
  const q = query({
    view: { holds: ['customer'], readings: { customer: { picked: ['Contoso'] } } },
    page: { holds: ['status'], readings: { status: { picked: ['active'] } } },
  });
  const w = walk(q, { parts: [['region', 'in', ['EMEA', 'AMER']]] });
  assert.deepEqual(w.results.view, { customer: 2 });
  // The page's own scope is walked too, from the View's end.
  assert.deepEqual(w.results.page, { status: 2 });
});

test('a chart part starts inside its host, is greyed by it, and is never set aside', () => {
  const q = query({
    view: { holds: ['region'], readings: { region: { picked: ['APAC'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['active'] } } },
    legend: { holds: ['customer'], readings: { customer: { picked: ['Litware', 'Contoso'] } }, narrows: ['chart'] },
  });
  const w = walk(q, { limit: false, narrowing: new Map([['legend', { field: 'customer', host: 'data' }]]) });
  // Inside APAC and active: Contoso and AW; Litware is greyed, and stays picked.
  assert.deepEqual(w.present.legend.customer.sort(), ['Adventure Works', 'Contoso']);
  assert.deepEqual(w.aside.legend, {});
  assert.deepEqual(w.results.legend, { customer: 1 });
});

/* ── The property: three ways, one answer ─────────────────────────────── */

/** A walk the plain way: each step over arrays, nothing shared. */
function referenceWalk(rows, plan) {
  const out = { results: {}, values: {}, present: {}, offered: {}, aside: {}, spent: {} };
  const ends = new Map();
  const keysOf = (rs, f) => [...new Set(rs.map((r) => readField(r, f)).filter((v) => v != null && v !== '').map(valueKey))];
  const match = (rs, f) => rs.filter((r) => matchesFilter(r, absoluteDates(f, plan.now)));
  for (const sc of plan.scopes) {
    const from = sc.after !== null ? ends.get(sc.after) : undefined;
    const start = from?.rows ?? rows;
    let narrowed = from?.narrowed ?? false;
    let reach = start;
    const at = [];
    const results = {}; const values = {}; const present = {}; const offered = {}; const aside = {};
    sc.steps.forEach((step) => {
      at.push(reach);
      let test = step.clause;
      const tally = step.field ? keysOf(reach, step.field) : [];
      if (sc.setsAside && step.on && test && step.picks?.length && step.less) {
        const ruled = step.ruler === 'here' ? tally : step.ruler === 'start' ? keysOf(start, step.field) : null;
        const out2 = step.picks.filter((k) => (ruled && !ruled.includes(k)) || (step.offers && narrowed && !tally.includes(k)));
        if (out2.length) { aside[step.field] = out2; test = step.less(out2); }
      }
      if (step.field && step.each?.length) values[step.field] = Object.fromEntries(step.each.map(([k, c]) => [k, match(reach, c).length]));
      if (step.counts && test) results[step.id] = match(reach, test).length;
      if (step.field && step.ruler) present[step.field] = step.ruler === 'here' ? tally : keysOf(start, step.field);
      if (step.field && step.offers && narrowed) offered[step.field] = tally;
      if (step.on && test) { reach = match(reach, test); narrowed = true; }
    });
    at.push(reach);
    const spent = [];
    for (const t of sc.taps) {
      const keys = t.ruler === 'here' ? keysOf(at[t.at], t.field) : keysOf(start, t.field);
      present[t.field] = keys;
      if (!keys.length) spent.push(t.field);
    }
    Object.assign(out.results, { [sc.scope]: results });
    out.values[sc.scope] = values; out.present[sc.scope] = present; out.offered[sc.scope] = offered;
    out.aside[sc.scope] = aside; out.spent[sc.scope] = spent;
    ends.set(sc.scope, { rows: reach, narrowed });
  }
  return out;
}

/** A pseudo-random Query over the fixture, from a seed. */
function randomQuery(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pickSome = (vals) => vals.filter(() => rnd() < 0.4);
  const VALUES = { region: Object.keys(REGION_ORGS), customer: ['Contoso', 'Adventure Works', 'Tailspin', 'Litware', 'contoso'], status: ['active', 'trial'] };
  const fields = ['region', 'customer', 'status'].sort(() => rnd() - 0.5);
  const scopeOf = (held) => {
    const readings = {};
    for (const f of held) {
      const picked = pickSome(VALUES[f]);
      if (picked.length) readings[f] = { picked, ...(rnd() < 0.2 ? { suspended: true } : {}) };
    }
    return { holds: held, readings };
  };
  return query({ view: scopeOf(fields.slice(0, 2)), data: scopeOf(fields.slice(2)) });
}

const strip = ({ ends: _e, ...w }) => JSON.parse(JSON.stringify(w));

test('the property: the walk, a plain walk and the step-by-step walk agree on 200 Queries', async () => {
  for (let seed = 1; seed <= 200; seed++) {
    const q = randomQuery(seed);
    const limit = seed % 2 === 0;
    const sets = seed % 3 === 0 ? () => [{ id: 's', mode: 'serial', fields: ['region', 'customer', 'status'] }] : () => [];
    const plan = planWalk(q, facts({ limit, sets }));
    const one = strip(walkInOrder(ROWS, plan));
    assert.deepEqual(one, strip(referenceWalk(ROWS, plan)), `seed ${seed}: the walk and the plain walk`);
    assert.deepEqual(one, strip(await walkStepwise(new ArrayStore(ROWS, { key: 'id' }), plan)), `seed ${seed}: step by step`);
  }
});
