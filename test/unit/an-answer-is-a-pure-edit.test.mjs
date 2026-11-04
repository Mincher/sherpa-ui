/**
 * AN ANSWER IS A PURE EDIT — plan 695 S5. Every edit that answers the Query —
 * an answer, the Switch, a solo, a reset, a preset, a hold, a take, a release, a
 * let-go, an Apply and a Discard — is `(copies, command) → copies`: the copies
 * given are untouched, and what each member must hear is said as the result, in
 * order. `ask()` puts the new Query in place and tells the members once. A
 * command that names no edit is reported, and moves nothing (TODO 718).
 * TRAP T-one-command-one-door
 *
 *   node --test test/unit/an-answer-is-a-pure-edit.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource, onReport } from '../../dist/data.js';
import { editCopies } from '../../dist/core/data/query-edits.js';

/** Freeze a value all the way down: an edit that writes it throws. */
const frozen = (v) => {
  if (v && typeof v === 'object') {
    for (const x of Object.values(v)) frozen(x);
    Object.freeze(v);
  }
  return v;
};

/** What a pure edit needs, as a page with no member says it. */
const facts = (over = {}) => ({
  remote: false, named: new Set(), parts: new Map(), offers: new Map([['data', ['plan', 'region']]]),
  presets: () => new Map(), opens: () => undefined, fixed: () => [], alwaysOn: () => [], knows: () => undefined, bindOf: () => undefined,
  presents: () => false, theirs: () => () => false, ...over,
});

/** A Query: the View holds region, the data bar plan, each answered. */
const query = () => ({
  v: 1,
  scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } },
    data: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } },
  },
});

test('every answering edit leaves the copies it is given untouched, and says what moved', () => {
  const presets = new Map([['pro', { label: 'Pro only', readings: { plan: { tree: { field: 'plan', op: 'eq', value: 'Pro' } } } }]]);
  const commands = [
    { scope: 'data', field: 'plan', reading: { picked: ['Free'] } },
    { scope: 'data', suspended: true },
    { scope: 'data', field: 'plan', suspended: true },
    { scope: 'data', solo: 'plan', across: true },
    { scope: 'data', reset: { organise: true } },
    { scope: 'data', preset: 'pro', on: true },
    { scope: 'data', hold: [] },
    { scope: VIEW, take: ['plan'], from: 'data' },
    { scope: 'data', release: 'plan' },
    { scope: 'data', field: 'plan', letGo: ['Pro'] },
    [{ scope: 'data', field: 'plan', reading: { picked: ['Free'] } }, { scope: 'data', field: 'region', reading: { picked: ['APAC'] } }],
  ];
  for (const command of commands) {
    const applied = frozen(query());
    const copies = { applied, draft: applied, solo: null };
    const done = editCopies(copies, command, facts({ presets: (s) => (s === 'data' ? presets : new Map()) }));
    assert.deepEqual(applied, query(), `${JSON.stringify(command)}: the copy given is untouched`);
    assert.notEqual(done.applied, applied, `${JSON.stringify(command)}: a new copy`);
    assert.ok(done.said.length, `${JSON.stringify(command)}: said what moved`);
  }
});

test('waiting, an Apply and a Discard are pure too: the draft moves, then what is applied', () => {
  const applied = frozen(query());
  const draft = frozen(query());
  const waits = facts({ named: new Set(['data']) });
  const edited = editCopies({ applied, draft, solo: null }, { scope: 'data', field: 'plan', reading: { picked: ['Free'] } }, waits);
  assert.deepEqual(edited.applied.scopes.data.readings.plan.picked, ['Pro'], 'a waiting scope keeps what is applied');
  assert.deepEqual(edited.draft.scopes.data.readings.plan.picked, ['Free']);
  const sent = editCopies(edited, { scope: 'data', commit: true }, waits);
  assert.deepEqual(sent.applied.scopes.data.readings.plan.picked, ['Free'], 'Apply sends it');
  assert.deepEqual(sent.said.map((c) => c.kind), ['commit']);
  const back = editCopies(edited, { scope: 'data', discard: true }, waits);
  assert.deepEqual(back.draft.scopes.data.readings.plan.picked, ['Pro'], 'Discard puts the applied answer back');
  assert.deepEqual(edited.draft.scopes.data.readings.plan.picked, ['Free'], 'and the copies it was given stay');
  assert.deepEqual(draft, query());
});

test("the Switch says the fields it turned off: what its compile once wrote is the edit's own", () => {
  const applied = frozen(query());
  const { said, draft } = editCopies({ applied, draft: applied, solo: null }, { scope: 'data', suspended: true }, facts());
  assert.deepEqual(draft.scopes.data.suspended, { fields: ['plan'] });
  assert.equal(draft.scopes.data.readings.plan.suspended, true);
  assert.deepEqual(said.find((c) => c.kind === 'drawn'), { kind: 'drawn', fields: ['plan'], bars: 'data' });
});

test("a hold's clear is said while the scope still holds the field: it is drawn there", () => {
  const applied = frozen(query());
  const { said, draft } = editCopies({ applied, draft: applied, solo: null }, { scope: 'data', hold: [] }, facts());
  assert.equal(draft.scopes.data, undefined, 'the scope is gone');
  assert.deepEqual(said.map((c) => c.kind), ['select', 'hold']);
  assert.deepEqual(said[0], { kind: 'select', field: 'plan', at: 'data' }, 'cleared in the scope that held it');
});

test('ask() puts the new Query in place and tells each member ONCE, with every change in order', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }), query });
  const heard = [];
  const member = {
    remote: false, pagedIn: () => false, presentsIn: () => false, page() {}, bindOf: () => undefined,
    heard: (changes) => { heard.push(changes.map((c) => c.kind)); }, has: () => false, carriesOver: () => false,
    readingsOf: () => ({}), raws: (_f, picked) => [...picked],
  };
  query.join(member);
  const grid = Object.assign(new EventTarget(), { id: 'grid', setAttribute() {}, removeAttribute() {}, populate() {} });
  bindSource(source, grid, { scope: 'data' });
  query.offer('data', ['plan']);
  await source.load();
  const events = [];
  query.addEventListener('query-change', (e) => events.push(e.detail));
  heard.length = 0;
  query.ask([{ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } }, { scope: 'data', sort: 'plan' }]);
  assert.deepEqual(heard, [['hold', 'select', 'bars', 'arranged']], 'one telling, in order');
  assert.equal(events.length, 1, 'one query-change');
  assert.deepEqual(query.reading('data', 'plan').picked, ['Pro'], 'in place before anyone heard');
  assert.ok(Object.isFrozen(query.reading('data', 'plan')), 'and frozen');
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1]);
});

test('a command that names no edit is reported and moves nothing; an Apply still applies (TODO 718)', async () => {
  const heard = [];
  const undo = onReport((r) => heard.push(r));
  try {
    // The data scope waits, with a pick not yet applied: an Apply would send it.
    const waits = facts({ named: new Set(['data']) });
    const edited = editCopies({ applied: frozen(query()), draft: frozen(query()), solo: null },
      { scope: 'data', field: 'plan', reading: { picked: ['Free'] } }, waits);
    for (const bad of [{ foo: 1 }, { scope: 'data', filter: 'status' }, {}, { commit: false }, null, 'commit', [{ foo: 1 }]]) {
      heard.length = 0;
      const done = editCopies(edited, bad, waits);
      assert.deepEqual([done.applied, done.draft, done.said], [edited.applied, edited.draft, []], `${JSON.stringify(bad)} moves nothing`);
      assert.deepEqual(heard.map((r) => r.code), ['unknown-request'], `${JSON.stringify(bad)} is said`);
    }
    heard.length = 0;
    assert.deepEqual(editCopies(edited, { scope: 'data', commit: true }, waits).applied.scopes.data.readings.plan.picked, ['Free'], 'an Apply sends it');

    // Through ask(), on a page: no query-change, nothing applied, every scope as it was.
    const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }) });
    const grid = Object.assign(new EventTarget(), { id: 'grid', setAttribute() {}, removeAttribute() {}, populate() {} });
    bindSource(source, grid, { scope: 'data' });
    source.query.offer('data', ['plan']);
    await source.load();
    source.query.wait('data');
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    const events = [];
    source.query.addEventListener('query-change', (e) => events.push(e.detail));
    const before = [source.query.applied, source.query.draft];
    heard.length = 0;
    source.query.ask({ foo: 1 });
    assert.deepEqual([source.query.applied, source.query.draft], before, 'the Query stays as it was');
    assert.deepEqual([events, heard.map((r) => r.code)], [[], ['unknown-request']]);
    assert.match(heard[0].message, /^ask: \{ foo \} names no edit the Query knows/);
    source.query.ask({ commit: true });
    assert.deepEqual(source.query.applied.scopes.data.readings.plan.picked, ['Pro'], 'a known one still applies');
    assert.equal(events.length, 1);
    await source.load();
    assert.deepEqual(source.rows.map((r) => r.id), [1]);
    assert.deepEqual(heard.map((r) => r.code), ['unknown-request'], 'and says nothing more');
  } finally {
    undo();
  }
});
