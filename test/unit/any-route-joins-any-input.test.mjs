/**
 * ANY ROUTE JOINS ANY INPUT — Will, 2026-11-05 (TODO 770, B): "any route joins any input, and a type mismatch
 * reads null with the warning; the socket shapes become hints." A socket's type is what its input needs where
 * its kind says no more; a route of another type is no fault and no refusal: the input reads null, and the
 * node warns in words, through `readInput` and `INPUT_WORDS`. What stays refused is the graph's SHAPE: a loop,
 * the same route twice, two into an input that takes one, a socket that is not there, a Rows row (it only
 * sends), a Group row from anything but a Condition's True, an output that says it sends any type, and a
 * row's own fault (P4).
 *
 *   node --test test/unit/any-route-joins-any-input.test.mjs
 *
 * TRAP T-a-node-reads-null-from-what-it-cannot-use · TRAP T-a-socket-says-its-type
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, SOCKET_WORDS, accepts } = await import(new URL('node-kinds.js', core));
const { INPUT_WORDS } = await import(new URL('node-input.js', core));
const { finalGraph, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

/** Each socket type, and an app's kind whose header and rows take one each, saying nothing more. */
const TYPES = ['value', 'object', 'boolean'];
const kinds = {
  ...NODE_KINDS,
  sink: {
    heading: 'Sink', icon: 'flag', input: 'boolean', model: 'x', graphs: ['workflow'],
    rows: TYPES.map((t) => ({ name: t, label: `Takes ${t}`, input: t })),
  },
};
/** What sends each type: a Value's value, a Store's rows, a Store's True. */
const SENDS = { value: 'v/value', object: 's/rows', boolean: 's' };
const SAID = { value: '"abc"', object: INPUT_WORDS.rows, boolean: INPUT_WORDS.boolean };
const flow = (routes) => ({
  v: 2, id: 'w',
  nodes: [
    { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'abc' } },
    { id: 's', kind: 'store', x: 0, y: 200, values: { store: 'users' } },
    { id: 'k', kind: 'sink', x: 360, y: 0 },
  ],
  routes,
});
const warnings = (w) => workflowGraph(w, {}, kinds).nodes.find((n) => n.id === 'k').warnings?.map((x) => [x.row ?? '', x.words]);

test('every output type into every typed input joins, no fault: its own is read; another reads null, in words', () => {
  for (const out of TYPES) {
    for (const into of TYPES) {
      const w = flow([{ from: SENDS[out], to: `k/${into}` }]);
      assert.deepEqual(workflowFaults(w, kinds), [], `${out} → ${into}: no fault`);
      const want = accepts(out, into) ? undefined : [[into, `Takes ${into} takes ${INPUT_WORDS[into]}; it was given ${SAID[out]}`]];
      assert.deepEqual(warnings(w), want, `${out} → ${into}`);
    }
  }
  // A typed header the same: the Sink's takes a boolean.
  assert.deepEqual(warnings(flow([{ from: 'v/value', to: 'k' }])), [['', 'Sink takes a boolean; it was given "abc"']]);
  assert.deepEqual(warnings(flow([{ from: 's', to: 'k' }])), undefined);
  // A socket's words are its tip's.
  for (const t of TYPES) assert.equal(INPUT_WORDS[t], SOCKET_WORDS[t]);
});

test('Will\'s own example: rows into Math › Value A join, Value A reads null, and Save writes the route', () => {
  const w = {
    v: 2, id: 'w',
    nodes: [{ id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } }, { id: 'm', kind: 'math', x: 360, y: 0 }],
    routes: [{ from: 's/rows', to: 'm/a' }],
  };
  const m = workflowGraph(w).nodes.find((n) => n.id === 'm');
  assert.deepEqual([workflowFaults(w), m.warnings, m.rows.find((r) => r.name === 'a').value], [[], [{ row: 'a', words: 'Value A takes a number; it was given rows' }], null]);
  assert.deepEqual(finalGraph(w).routes, w.routes);
});

test('the graph\'s shape stays refused, in words: a loop, twice, two into one, no socket, a Rows row, a Group row, an any output, a row\'s own fault', () => {
  const base = {
    v: 2, id: 'w',
    nodes: [
      { id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
      { id: 'v', kind: 'value', x: 0, y: 200, values: { value: 'abc' } },
      { id: 'h', kind: 'value', x: 0, y: 400, values: { type: 'decimal', value: '1.5' } },
      { id: 'c', kind: 'condition', x: 360, y: 0 }, { id: 'd', kind: 'condition', x: 720, y: 0 },
      { id: 'm', kind: 'math', x: 360, y: 400, values: { type: 'round' } },
    ],
  };
  const faults = (routes, more = []) => workflowFaults({ ...base, nodes: [...base.nodes, ...more], routes }, kinds);
  assert.deepEqual(faults([{ from: 'c/rows', to: 'd' }, { from: 'd/rows', to: 'c' }]), ['its routes run in a loop']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c' }, { from: 's/rows', to: 'c' }]), ['the route "s/rows" → "c" is there twice']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c' }, { from: 'v/value', to: 'c' }]), ['two routes enter "c", which takes one']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c/nowhere' }]), ['a route enters "c/nowhere", which is no input socket']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c/rows' }]), ['a route enters "c/rows", a Rows row, which only sends: a node\'s rows come in on its header']);
  assert.deepEqual(faults([{ from: 'v', to: 'd/group' }]), ['the route "v" → "d/group" enters a Group row, which takes only the True of a condition']);
  assert.deepEqual(faults([{ from: 'c', to: 'd/group' }]), [], 'a Condition\'s True nests its group');
  const odd = { id: 'o', kind: 'odd', x: 0, y: 600 };
  const withOdd = { ...kinds, odd: { heading: 'Odd', icon: 'flag', output: 'any', rows: [], model: 'x', graphs: ['workflow'] } };
  assert.deepEqual(workflowFaults({ ...base, nodes: [...base.nodes, odd], routes: [{ from: 'o', to: 'k' }] }, withOdd).slice(0, 1), ['a route leaves "o", which sends any type: an output says the one it sends']);
  assert.deepEqual(faults([{ from: 'h/value', to: 'm/places' }]), ['the route "h/value" → "m/places": 1.5 is not a whole number']);
});
