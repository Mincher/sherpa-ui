/**
 * SIMULATE runs a graph on cached rows: each node's incoming and outgoing slots, a row list on each socket. A Condition keeps
 * what its test holds by the engine a page runs, by Pass, and the rest by Fail (plan 971); And keeps what every part kept, Or what any part kept;
 * a Source not fetched says so; a portal's rows flow; nothing is written and the same in gives the same out. Will, TODO 836
 * · docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 *   node --test test/unit/a-simulation-reads-the-cache-and-writes-nothing.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { lightOf, trueOf, SimulationControl, simulateGraph, simulation, stepSimulation } = await import(new URL('node-simulate.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));
const { filterRows } = await import(new URL('store.js', core));

const R = (from, to) => ({ from, to });
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'p', nodes, connections });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const into = (sim, id, socket) => sim.nodes[id].incoming.find((s) => s.socket === socket);

let seed = 5;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const STATES = ['active', 'trial', 'suspended', 'churned'];
const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: i, status: STATES[Math.floor(rnd() * 4)], seats: Math.floor(rnd() * 100), region: rnd() < 0.5 ? 'EMEA' : 'APAC' }));

// Source › Field › Condition › Output.
const chain = (field, type, b) => graphOf(
  [N('s', 'source', { store: 'customers' }), N('f', 'field', { field }), N('c', 'condition', { type, b }), N('o', 'result')],
  [R('s/rows', 'f'), R('f/field', 'c'), R('c/pass', 'o')],
);

test('a Source sends the cached rows; a Field sends its name and the rows into it; the Output hears what is connected to it', () => {
  const rows = rowsOf(30);
  const sim = simulateGraph(chain('status', 'eq', 'active'), { customers: rows });
  assert.equal(out(sim, 's', 's/rows').rows, rows, 'the cache\'s own list, never a copy');
  const f = out(sim, 'f', 'f/field');
  assert.deepEqual([f.kind, f.value, f.rows], ['field', 'status', rows]);
  assert.deepEqual(into(sim, 'o', 'o').rows, rows.filter((r) => r.status === 'active'));
  assert.deepEqual(sim.faults, []);
});

test('a Condition agrees with the filter engine on random rows: eq, ne, gt, lt, in; its Fail the rest; no True and no fork (plan 971 §9)', () => {
  const tests = [['status', 'eq', 'active'], ['status', 'ne', 'trial'], ['seats', 'gt', 50], ['seats', 'lt', 10], ['region', 'eq', 'EMEA'], ['status', 'in', ['trial', 'churned']]];
  for (let round = 0; round < 20; round++) {
    const rows = rowsOf(10 + Math.floor(rnd() * 90));
    const [field, type, b] = tests[round % tests.length];
    const sim = simulateGraph(chain(field, type, b), { customers: rows });
    const kept = filterRows(rows, [field, type, b]);
    assert.deepEqual(out(sim, 'c', 'c/pass').rows, kept, `${field} ${type}`);
    assert.deepEqual(out(sim, 'c', 'c/fail').rows, rows.filter((r) => !kept.includes(r)), `${field} ${type} Fail`);
    // No True or False socket, and no True row (plans 944, 971 §9).
    assert.deepEqual([out(sim, 'c', 'c'), out(sim, 'c', 'c/#false'), out(sim, 'c', 'c/true')], [undefined, undefined, undefined], `${field} ${type}: no fork`);
  }
});

test('two tests in a row are And: the second keeps what the first kept', () => {
  const rows = rowsOf(60);
  const g = graphOf(
    [N('s', 'source', { store: 'customers' }), N('f1', 'field', { field: 'status' }), N('a', 'condition', { type: 'eq', b: 'active' }),
      N('f2', 'field', { field: 'region' }), N('b', 'condition', { type: 'eq', b: 'EMEA' }), N('o', 'result')],
    [R('s/rows', 'f1'), R('f1/field', 'a'), R('a/pass', 'f2'), R('f2/field', 'b'), R('b/pass', 'o')],
  );
  const sim = simulateGraph(g, { customers: rows });
  assert.deepEqual(into(sim, 'o', 'o').rows, rows.filter((r) => r.status === 'active' && r.region === 'EMEA'));
});

test('And keeps what every part kept, Or what any part kept, their Pass in; the rows are the cache\'s own (939)', () => {
  const rows = rowsOf(80);
  const parts = [N('s', 'source', { store: 'customers' }), N('f1', 'field', { field: 'status' }), N('a', 'condition', { type: 'eq', b: 'active' }),
    N('f2', 'field', { field: 'region' }), N('b', 'condition', { type: 'eq', b: 'EMEA' })];
  const wired = [R('s/rows', 'f1'), R('s/rows', 'f2'), R('f1/field', 'a'), R('f2/field', 'b'), R('a/pass', 'j'), R('b/pass', 'j'), R('j/pass', 'o')];
  for (const [type, keep] of [['and', (r) => r.status === 'active' && r.region === 'EMEA'], ['or', (r) => r.status === 'active' || r.region === 'EMEA']]) {
    const sim = simulateGraph(graphOf([...parts, N('j', 'condition', { type }), N('o', 'result')], wired), { customers: rows });
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
  const two = graphOf([N('s', 'source', { store: 'customers' }), N('t', 'source', { store: 'devices' }), N('o', 'result')], [R('s/rows', 'o'), R('t/rows', 'o')]);
  const rows = rowsOf(5);
  assert.equal(into(simulateGraph(two, { customers: rows }), 'o', 'o').rows.length, 5);
});

test('a test with no Field says why, and its rows are none, not all', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('c', 'condition', { type: 'eq', b: 'active' }), N('o', 'result')], [R('s/rows', 'c'), R('c/pass', 'o')]);
  const sim = simulateGraph(g, { customers: rowsOf(5) });
  assert.ok(sim.faults.some((f) => f.includes('tests no Field')), JSON.stringify(sim.faults));
  assert.deepEqual([out(sim, 'c', 'c/pass').rows, out(sim, 'c', 'c/fail').rows], [undefined, undefined]);
});

test('a kind not simulated yet says so and sends no rows', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'seats' }), N('m', 'preset', {}), N('o', 'result')],
    [R('s/rows', 'f'), R('f/field', 'm')]);
  const sim = simulateGraph(g, { customers: rowsOf(5) });
  assert.ok(sim.faults.includes('"Preset" is not simulated yet'), JSON.stringify(sim.faults));
});

test('rows flow through a portal as through a connection', () => {
  const rows = rowsOf(40);
  const g = graphOf(
    [N('s', 'source', { store: 'customers' }), N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'rows' }),
      N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'trial' }), N('o', 'result')],
    [R('s/rows', 'in'), R('out/@s/rows', 'f'), R('f/field', 'c'), R('c/pass', 'o')],
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
  const nodes = [N('s', 'source', { store: 'customers' }), N('o', 'result')];
  const connections = [];
  let from = 's/rows';
  tests.forEach(([field, type, b], i) => {
    nodes.push(N(`f${i}`, 'field', { field }), N(`c${i}`, 'condition', { type, b }));
    connections.push(R(from, `f${i}`), R(`f${i}/field`, `c${i}`));
    from = `c${i}/pass`;
  });
  connections.push(R(from, 'o'));
  const g = graphOf(nodes, connections);
  simulateGraph(g, { customers: rows });
  const start = performance.now();
  const sim = simulateGraph(g, { customers: rows });
  const ms = performance.now() - start;
  t.diagnostic(`100,000 rows, 5 Conditions: ${ms.toFixed(0)} ms`);
  assert.equal(into(sim, 'o', 'o').rows.length, filterRows(rows, ['and', ...tests.map(([f, t, b]) => [f, t, b])]).length);
  assert.ok(ms < 1000, `${ms} ms`);
});

test('a Math Count is the row count: a Source\'s rows, a Field\'s rows into it, a Condition\'s Pass; none, a note (plan 944)', () => {
  const rows = rowsOf(60);
  // No node has a Count row now: a Math Count counts what reaches it (plan 944).
  const counted = graphOf(
    [N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'active' }),
      N('ms', 'math', { type: 'count' }), N('mf', 'math', { type: 'count' }), N('mc', 'math', { type: 'count' }), N('lone', 'math', { type: 'count' })],
    [R('s/rows', 'f'), R('f/field', 'c'), R('s/rows', 'ms/rows'), R('f/field', 'mf/rows'), R('c/pass', 'mc/rows')],
  );
  const sim = simulateGraph(counted, { customers: rows });
  const kept = rows.filter((r) => r.status === 'active').length;
  assert.deepEqual([out(sim, 'ms', 'ms/result').kind, out(sim, 'ms', 'ms/result').value], ['value', 60]);
  assert.equal(out(sim, 'mf', 'mf/result').value, 60);
  assert.equal(out(sim, 'mc', 'mc/result').value, kept);
  assert.deepEqual([out(sim, 's', 's/count'), out(sim, 'c', 'c/count')], [undefined, undefined], 'no Count row');
  const none = simulateGraph(counted, {});
  assert.deepEqual([out(none, 'ms', 'ms/result').value, out(none, 'ms', 'ms/result').note], [undefined, 'Not fetched yet']);
  assert.equal(out(none, 'mc', 'mc/result').value, undefined);
  assert.deepEqual([out(none, 'lone', 'lone/result').value, out(none, 'lone', 'lone/result').note], [undefined, 'No rows reach it']);
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

test('a simulation in steps: it names its nodes, runs nothing until stepped, and stepped whole it is simulateGraph', () => {
  const rows = rowsOf(40);
  const g = chain('status', 'eq', 'active');
  const run = simulation(g, { customers: rows });
  assert.deepEqual(run.ids, ['s', 'f', 'c', 'o']);
  assert.deepEqual(run.result().nodes, {}, 'nothing has run');
  run.step('c');
  assert.deepEqual(Object.keys(run.result().nodes), ['c'], 'one step runs one node, and what it hears is read, not run');
  run.step('c');
  run.step('nope');
  for (const id of run.ids) run.step(id);
  assert.deepEqual(run.result(), simulateGraph(g, { customers: rows }));
  // The doors a Custom Node's inside draws (`#in`, `#out`) are not run.
  const node = (id) => ({ id, kind: 'x', heading: id, icon: '', rows: [], x: 0, y: 0 });
  assert.deepEqual(simulation({ nodes: [node('#in'), node('a'), node('#out')], connections: [] }, {}).ids, ['a']);
});

test('stepping lets the host in when a node has run long, and says each node before it runs: the page can draw the one it is on', async () => {
  const rows = rowsOf(20);
  const g = chain('status', 'eq', 'active');
  const told = [];
  let pauses = 0;
  let clock = 0;
  // Each look at the clock is 20 ms on: a node runs 20 ms, over the 15, and the host has a turn after each.
  const slow = await stepSimulation(simulation(g, { customers: rows }), { onStep: (id) => told.push(id), pause: async () => { pauses++; }, now: () => (clock += 20), every: 15 });
  assert.deepEqual(told, ['s', 'f', 'c', 'o']);
  assert.equal(pauses, 4);
  // Quick nodes: the host is not asked, so a fast graph pays nothing.
  clock = 0;
  pauses = 0;
  const quick = await stepSimulation(simulation(g, { customers: rows }), { pause: async () => { pauses++; }, now: () => clock, every: 15 });
  assert.equal(pauses, 0);
  assert.deepEqual(quick, slow);
  assert.deepEqual(quick, simulateGraph(g, { customers: rows }));
});

test('the nodes run in the order the data flows, whatever order the graph lists them in; a loop keeps the listed order', () => {
  const g = chain('status', 'eq', 'active');
  const backwards = { ...g, nodes: [...g.nodes].reverse() };
  assert.deepEqual(simulation(backwards, {}).ids, ['s', 'f', 'c', 'o']);
  const some = rowsOf(10);
  assert.deepEqual(simulateGraph(backwards, { customers: some }), simulateGraph(g, { customers: some }));
  const loop = graphOf([N('x', 'condition', { type: 'and' }), N('y', 'condition', { type: 'or' })], [R('x', 'y'), R('y', 'x')]);
  assert.deepEqual(simulation(loop, {}).ids.sort(), ['x', 'y']);
});

test('each node says how long it took, to the host that asked', async () => {
  let clock = 0;
  const took = {};
  await stepSimulation(simulation(chain('status', 'eq', 'active'), { customers: rowsOf(10) }), { onDone: (id, ms) => { took[id] = ms; }, now: () => (clock += 7) });
  assert.deepEqual(took, { s: 7, f: 7, c: 7, o: 7 });
});

test('a node\'s light: the rows it heard and said, "120 → 30", and its time; the one count of a Source or an Output; why, where none', () => {
  const rows = rowsOf(120);
  const kept = rows.filter((r) => r.status === 'active').length;
  const sim = simulateGraph(chain('status', 'eq', 'active'), { customers: rows });
  assert.equal(lightOf(sim.nodes.s, 3.4), '120 rows · 3 ms');
  assert.equal(lightOf(sim.nodes.c, 12.2), `120 → ${kept} · 12 ms`);
  // An Output says what it would do first: it does nothing (plan 891).
  assert.equal(lightOf(sim.nodes.o, 0.2), `Would end the run · ${kept} rows · <1 ms`);
  assert.equal(lightOf(simulateGraph(chain('status', 'eq', 'active'), { customers: rows.slice(0, 1) }).nodes.s, 1500), '1 row · 1,500 ms');
  assert.equal(lightOf(simulateGraph(chain('status', 'eq', 'active'), {}).nodes.s, 2), 'Not fetched yet · 2 ms');
  assert.equal(lightOf({ incoming: [], outgoing: [] }, 5), '5 ms');
});

test('the rows true: a test\'s Pass is what passed, its Fail the rest; a test nothing passes keeps 0 rows (plan 971)', () => {
  // trueOf is gone: a test's Pass and Fail rows say it (plans 944, 971 §9).
  assert.equal(trueOf, undefined);
  const rows = rowsOf(120);
  const kept = rows.filter((r) => r.status === 'active').length;
  const said = (sim) => [out(sim, 'c', 'c/pass').rows?.length, out(sim, 'c', 'c/fail').rows?.length];
  assert.deepEqual(said(simulateGraph(chain('status', 'eq', 'active'), { customers: rows })), [kept, 120 - kept]);
  assert.deepEqual(said(simulateGraph(chain('status', 'eq', 'no-such-status'), { customers: rows })), [0, 120]);
  assert.deepEqual(said(simulateGraph(chain('status', 'eq', 'active'), {})), [undefined, undefined]);
});

test('Pause lets the node in hand finish and goes no further; Play goes on from the next node; Stop ends the run, keeping the nodes done', async () => {
  const rows = rowsOf(20);
  const ids = () => simulation(chain('status', 'eq', 'active'), { customers: rows }).ids;
  assert.equal(ids().length, 4);
  // Paused after the first node: the second waits.
  const control = new SimulationControl();
  const ran = [];
  const held = [];
  const done = stepSimulation(simulation(chain('status', 'eq', 'active'), { customers: rows }), {
    control,
    onStep: (id) => ran.push(id),
    onDone: () => { if (ran.length === 1) control.pause(); },
    onPause: (paused, at) => held.push([paused, at]),
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(ran, ['s'], 'one node ran, and the run waits');
  assert.equal(control.paused, true);
  assert.deepEqual(held, [[true, 'f']]);
  // Play: it goes on from the node it waits at, and finishes.
  control.play();
  const result = await done;
  assert.deepEqual(ran, ['s', 'f', 'c', 'o']);
  assert.equal(Object.keys(result.nodes).length, 4);
  assert.deepEqual(held, [[true, 'f'], [false, 'f']]);

  // Stop, while paused: the run ends there, with the nodes it had done.
  const stopper = new SimulationControl();
  const seen = [];
  const ended = stepSimulation(simulation(chain('status', 'eq', 'active'), { customers: rows }), {
    control: stopper,
    onStep: (id) => seen.push(id),
    onDone: () => { if (seen.length === 2) stopper.pause(); },
  });
  await new Promise((r) => setTimeout(r, 20));
  stopper.stop();
  const partial = await ended;
  assert.deepEqual(seen, ['s', 'f']);
  assert.deepEqual(Object.keys(partial.nodes).sort(), ['f', 's']);
  assert.equal(stopper.stopped, true);
});
