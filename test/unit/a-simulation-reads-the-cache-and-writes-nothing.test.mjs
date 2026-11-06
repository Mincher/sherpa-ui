/**
 * SIMULATE runs a graph on cached rows: each node's incoming and outgoing slots, a row list on each socket. A Condition keeps
 * what its test holds by the engine a page runs, its False the rest; And keeps what every part kept, Or what any part kept;
 * a Source not fetched says so; a portal's rows flow; nothing is written and the same in gives the same out. Will, TODO 836
 * · docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 *   node --test test/unit/a-simulation-reads-the-cache-and-writes-nothing.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { simulateGraph } = await import(new URL('node-simulate.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));
const { filterRows } = await import(new URL('store.js', core));

const R = (from, to) => ({ from, to });
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, routes) => workflowGraph({ v: 2, id: 'p', nodes, routes });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const into = (sim, id, socket) => sim.nodes[id].incoming.find((s) => s.socket === socket);

let seed = 5;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const STATES = ['active', 'trial', 'suspended', 'churned'];
const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: i, status: STATES[Math.floor(rnd() * 4)], seats: Math.floor(rnd() * 100), region: rnd() < 0.5 ? 'EMEA' : 'APAC' }));

// Source › Field › Condition › Output.
const chain = (field, type, b) => graphOf(
  [N('s', 'source', { store: 'customers' }), N('f', 'field', { field }), N('c', 'condition', { type, b }), N('o', 'output')],
  [R('s/rows', 'f'), R('f/field', 'c'), R('c/rows', 'o')],
);

test('a Source sends the cached rows; a Field sends its name and the rows into it; the Output hears what is routed to it', () => {
  const rows = rowsOf(30);
  const sim = simulateGraph(chain('status', 'eq', 'active'), { customers: rows });
  assert.equal(out(sim, 's', 's/rows').rows, rows, 'the cache\'s own list, never a copy');
  const f = out(sim, 'f', 'f/field');
  assert.deepEqual([f.kind, f.value, f.rows], ['field', 'status', rows]);
  assert.deepEqual(into(sim, 'o', 'o').rows, rows.filter((r) => r.status === 'active'));
  assert.deepEqual(sim.faults, []);
});

test('a Condition agrees with the filter engine on random rows: eq, ne, gt, lt, in; its False is the rest', () => {
  const tests = [['status', 'eq', 'active'], ['status', 'ne', 'trial'], ['seats', 'gt', 50], ['seats', 'lt', 10], ['region', 'eq', 'EMEA'], ['status', 'in', ['trial', 'churned']]];
  for (let round = 0; round < 20; round++) {
    const rows = rowsOf(10 + Math.floor(rnd() * 90));
    const [field, type, b] = tests[round % tests.length];
    const sim = simulateGraph(chain(field, type, b), { customers: rows });
    const kept = filterRows(rows, [field, type, b]);
    assert.deepEqual(out(sim, 'c', 'c/rows').rows, kept, `${field} ${type}`);
    assert.deepEqual(out(sim, 'c', 'c/#false').rows, rows.filter((r) => !kept.includes(r)), `${field} ${type} False`);
    assert.equal(out(sim, 'c', 'c').rows.length, kept.length, 'its True is the same rows');
  }
});

test('two tests in a row are And: the second keeps what the first kept', () => {
  const rows = rowsOf(60);
  const g = graphOf(
    [N('s', 'source', { store: 'customers' }), N('f1', 'field', { field: 'status' }), N('a', 'condition', { type: 'eq', b: 'active' }),
      N('f2', 'field', { field: 'region' }), N('b', 'condition', { type: 'eq', b: 'EMEA' }), N('o', 'output')],
    [R('s/rows', 'f1'), R('f1/field', 'a'), R('a/rows', 'f2'), R('f2/field', 'b'), R('b/rows', 'o')],
  );
  const sim = simulateGraph(g, { customers: rows });
  assert.deepEqual(into(sim, 'o', 'o').rows, rows.filter((r) => r.status === 'active' && r.region === 'EMEA'));
});

test('And keeps what every part kept, Or what any part kept; the rows are the cache\'s own', () => {
  const rows = rowsOf(80);
  const parts = [N('s', 'source', { store: 'customers' }), N('f1', 'field', { field: 'status' }), N('a', 'condition', { type: 'eq', b: 'active' }),
    N('f2', 'field', { field: 'region' }), N('b', 'condition', { type: 'eq', b: 'EMEA' })];
  const wired = [R('s/rows', 'f1'), R('s/rows', 'f2'), R('f1/field', 'a'), R('f2/field', 'b'), R('a', 'j'), R('b', 'j'), R('j/rows', 'o')];
  for (const [type, keep] of [['and', (r) => r.status === 'active' && r.region === 'EMEA'], ['or', (r) => r.status === 'active' || r.region === 'EMEA']]) {
    const sim = simulateGraph(graphOf([...parts, N('j', 'condition', { type }), N('o', 'output')], wired), { customers: rows });
    const got = into(sim, 'o', 'o').rows;
    assert.deepEqual(new Set(got), new Set(rows.filter(keep)), type);
    assert.ok(got.every((r) => rows.includes(r)));
  }
});

test('a Source with no cached rows is "not fetched yet": a note and a fault, never an empty list', () => {
  const sim = simulateGraph(chain('status', 'eq', 'active'), {});
  const s = out(sim, 's', 's/rows');
  assert.deepEqual([s.rows, s.note], [undefined, 'Not fetched yet']);
  assert.ok(sim.faults.includes('"Source" is not fetched yet'), JSON.stringify(sim.faults));
  assert.equal(into(sim, 'o', 'o').rows, undefined);
  // One store fetched, another not: the first answers.
  const two = graphOf([N('s', 'source', { store: 'customers' }), N('t', 'source', { store: 'devices' }), N('o', 'output')], [R('s/rows', 'o'), R('t/rows', 'o')]);
  const rows = rowsOf(5);
  assert.equal(into(simulateGraph(two, { customers: rows }), 'o', 'o').rows.length, 5);
});

test('a test with no Field says why, and its rows are none, not all', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('c', 'condition', { type: 'eq', b: 'active' }), N('o', 'output')], [R('s/rows', 'c'), R('c/rows', 'o')]);
  const sim = simulateGraph(g, { customers: rowsOf(5) });
  assert.ok(sim.faults.some((f) => f.includes('tests no Field')), JSON.stringify(sim.faults));
  assert.equal(out(sim, 'c', 'c/rows').rows, undefined);
});

test('a kind not simulated yet says so and sends no rows', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'seats' }), N('m', 'math', { type: 'round' }), N('o', 'output')],
    [R('s/rows', 'f'), R('f/field', 'm'), R('m/result', 'o')]);
  const sim = simulateGraph(g, { customers: rowsOf(5) });
  assert.ok(sim.faults.includes('"Math" is not simulated yet'), JSON.stringify(sim.faults));
});

test('rows flow through a portal as through a route', () => {
  const rows = rowsOf(40);
  const g = graphOf(
    [N('s', 'source', { store: 'customers' }), N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'rows' }),
      N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'trial' }), N('o', 'output')],
    [R('s/rows', 'in'), R('out/@s/rows', 'f'), R('f/field', 'c'), R('c/rows', 'o')],
  );
  const sim = simulateGraph(g, { customers: rows });
  assert.deepEqual(into(sim, 'o', 'o').rows, rows.filter((r) => r.status === 'trial'));
});

test('the same in gives the same out, and the rows are not changed', () => {
  const rows = rowsOf(50);
  const copy = structuredClone(rows);
  const g = chain('seats', 'gt', 25);
  const first = simulateGraph(g, { customers: rows });
  assert.deepEqual(simulateGraph(g, { customers: rows }), first);
  assert.deepEqual(rows, copy, 'nothing written');
});

test('it is fast: 100,000 rows through a Source, a Field, five Conditions and an Output', (t) => {
  const rows = rowsOf(100_000);
  const tests = [['status', 'ne', 'churned'], ['seats', 'gt', 5], ['seats', 'lt', 95], ['region', 'eq', 'EMEA'], ['status', 'ne', 'suspended']];
  const nodes = [N('s', 'source', { store: 'customers' }), N('o', 'output')];
  const routes = [];
  let from = 's/rows';
  tests.forEach(([field, type, b], i) => {
    nodes.push(N(`f${i}`, 'field', { field }), N(`c${i}`, 'condition', { type, b }));
    routes.push(R(from, `f${i}`), R(`f${i}/field`, `c${i}`));
    from = `c${i}/rows`;
  });
  routes.push(R(from, 'o'));
  const g = graphOf(nodes, routes);
  simulateGraph(g, { customers: rows });
  const start = performance.now();
  const sim = simulateGraph(g, { customers: rows });
  const ms = performance.now() - start;
  t.diagnostic(`100,000 rows, 5 Conditions: ${ms.toFixed(0)} ms`);
  assert.equal(into(sim, 'o', 'o').rows.length, filterRows(rows, ['and', ...tests.map(([f, t, b]) => [f, t, b])]).length);
  assert.ok(ms < 1000, `${ms} ms`);
});

test('a Count row is the row count: a Source\'s rows, a Field\'s rows into it, a Condition\'s rows it kept; none to count, a note (TODO 835)', () => {
  const rows = rowsOf(60);
  const sim = simulateGraph(chain('status', 'eq', 'active'), { customers: rows });
  const kept = rows.filter((r) => r.status === 'active').length;
  assert.deepEqual([out(sim, 's', 's/count').kind, out(sim, 's', 's/count').value], ['value', 60]);
  assert.equal(out(sim, 'f', 'f/count').value, 60);
  assert.equal(out(sim, 'c', 'c/count').value, kept);
  const none = simulateGraph(chain('status', 'eq', 'active'), {});
  assert.deepEqual([out(none, 's', 's/count').value, out(none, 's', 's/count').note], [undefined, 'No rows to count']);
  assert.equal(out(none, 'c', 'c/count').value, undefined);
});

test('where a fetch stopped at its cap, the Source says so beside its rows', () => {
  const rows = rowsOf(10);
  const words = 'PARTIAL: the first 10 of 40 rows.';
  const sim = simulateGraph(chain('status', 'eq', 'active'), { customers: rows }, { partial: { customers: words } });
  const source = out(sim, 's', 's/rows');
  assert.deepEqual([source.rows, source.note], [rows, words]);
  assert.deepEqual(sim.faults, []);
  // Another store's words are no one else's.
  assert.equal(out(simulateGraph(chain('status', 'eq', 'active'), { customers: rows }, { partial: { devices: words } }), 's', 's/rows').note, undefined);
});
