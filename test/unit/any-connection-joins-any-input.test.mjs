/**
 * ANY CONNECTION JOINS ANY INPUT — Will, 2026-11-05 (TODO 770, B): "any connection joins any input, and a type mismatch
 * reads null with the warning; the socket shapes become hints." A socket's type is what its input needs where
 * its kind says no more; a connection of another type is no fault and no refusal: the input reads null, and the
 * node warns in words, through `readInput` and `INPUT_WORDS`. What stays refused is the graph's SHAPE: a loop,
 * the same connection twice, two into an input that takes one, a socket that is not there, a Rows row (it only
 * sends), an output that says it sends any type, and a row's own fault (P4). And and Or take any boolean
 * (TODO 780, plan 783 D4).
 *
 *   node --test test/unit/any-connection-joins-any-input.test.mjs
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
/** What sends each type: a Value's value, a Source's rows, a Time's header (a Condition has no True, plan 971 §9). */
const SENDS = { value: 'v/value', object: 's/rows', boolean: 't' };
const SAID = { value: '"abc"', object: INPUT_WORDS.rows, boolean: INPUT_WORDS.boolean };
const flow = (connections) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'abc' } },
    { id: 's', kind: 'source', x: 0, y: 200, values: { store: 'users' } },
    { id: 't', kind: 'time', x: 0, y: 400 },
    { id: 'c', kind: 'condition', x: 0, y: 600 },
    { id: 'k', kind: 'sink', x: 360, y: 0 },
  ],
  connections,
});
const warnings = (w) => workflowGraph(w, {}, kinds).nodes.find((n) => n.id === 'k').warnings?.map((x) => [x.row ?? '', x.words]);

test('every output type into every typed input joins, no fault: its own is read; another reads null, in words', () => {
  for (const out of TYPES) {
    for (const into of TYPES) {
      const w = flow([{ from: SENDS[out], to: `k/${into}` }]);
      assert.deepEqual(workflowFaults(w, kinds), [], `${out} → ${into}: no fault`);
      // A True or False into a value reads as the word (COERCIONS, TODO 781): no warning.
      const want = accepts(out, into) || (out === 'boolean' && into === 'value') ? undefined : [[into, `Takes ${into} takes ${INPUT_WORDS[into]}; it was given ${SAID[out]}`]];
      assert.deepEqual(warnings(w), want, `${out} → ${into}`);
    }
  }
  // A typed header the same: the Sink's takes a boolean.
  assert.deepEqual(warnings(flow([{ from: 'v/value', to: 'k' }])), [['', 'Sink takes a boolean; it was given "abc"']]);
  assert.deepEqual(warnings(flow([{ from: 't', to: 'k' }])), undefined);
  // A test of one value's Pass sends the value it tests: a value reads it; a boolean or an object does not (plan 971 §9).
  assert.deepEqual(['k/value', 'k/boolean', 'k/object'].map((to) => warnings(flow([{ from: 'v/value', to: 'c' }, { from: 'c/pass', to }]))), [
    undefined, [['boolean', 'Takes boolean takes a boolean; it was given "abc"']], [['object', 'Takes object takes an object; it was given "abc"']],
  ]);
  // A socket's words are its tip's.
  for (const t of TYPES) assert.equal(INPUT_WORDS[t], SOCKET_WORDS[t]);
});

test('Will\'s own example: rows into Math › Value A join, Value A reads null, and Save writes the connection', () => {
  const w = {
    v: 3, id: 'w',
    nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'm', kind: 'math', x: 360, y: 0 }],
    connections: [{ from: 's/rows', to: 'm/a' }],
  };
  const m = workflowGraph(w).nodes.find((n) => n.id === 'm');
  assert.deepEqual([workflowFaults(w), m.warnings, m.rows.find((r) => r.name === 'a').value], [[], [{ row: 'a', words: 'Value A takes a number; it was given rows' }], null]);
  assert.deepEqual(finalGraph(w).connections, w.connections);
});

test('the graph\'s shape stays refused, in words: a loop, twice, two into one, no socket, a Rows row, an any output, a row\'s own fault; And takes any boolean', () => {
  const base = {
    v: 3, id: 'w',
    nodes: [
      { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'v', kind: 'value', x: 0, y: 200, values: { value: 'abc' } },
      { id: 'h', kind: 'value', x: 0, y: 400, values: { type: 'decimal', value: '1.5' } },
      { id: 'c', kind: 'condition', x: 360, y: 0 }, { id: 'd', kind: 'condition', x: 720, y: 0 },
      { id: 'm', kind: 'math', x: 360, y: 400, values: { type: 'round' } },
    ],
  };
  const faults = (connections, more = []) => workflowFaults({ ...base, nodes: [...base.nodes, ...more], connections }, kinds);
  assert.deepEqual(faults([{ from: 'c/pass', to: 'd' }, { from: 'd/pass', to: 'c' }]), ['its connections run in a loop']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c' }, { from: 's/rows', to: 'c' }]), ['the connection "s/rows" → "c" is there twice']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c' }, { from: 'v/value', to: 'c' }]), ['two connections enter "c", which takes one']);
  assert.deepEqual(faults([{ from: 's/rows', to: 'c/nowhere' }]), ['a connection enters "c/nowhere", which is no input socket']);
  assert.deepEqual(faults([{ from: 'v/value', to: 's/rows' }]), ['a connection enters "s/rows", its Results row, which only sends: what a node takes comes in on its header or an input row']);
  assert.deepEqual(faults([{ from: 'v/value', to: 'c/pass' }]), ['a connection enters "c/pass", its Pass row, which only sends: what a node takes comes in on its header or an input row']);
  // And takes any boolean (TODO 780, plan 783 D4): a Condition's Pass and another's (plan 971 §9).
  const and = { id: 'a', kind: 'condition', x: 900, y: 0, values: { type: 'and' } };
  assert.deepEqual(faults([{ from: 'd/pass', to: 'a' }, { from: 'c/pass', to: 'a' }], [and]), []);
  assert.deepEqual(faults([{ from: 'd', to: 'a' }], [and]), ['a connection leaves "d", which is no output socket']);
  const odd = { id: 'o', kind: 'odd', x: 0, y: 600 };
  const withOdd = { ...kinds, odd: { heading: 'Odd', icon: 'flag', output: 'any', rows: [], model: 'x', graphs: ['workflow'] } };
  assert.deepEqual(workflowFaults({ ...base, nodes: [...base.nodes, odd], connections: [{ from: 'o', to: 'k' }] }, withOdd).slice(0, 1), ['a connection leaves "o", which sends any type: an output says the one it sends']);
  assert.deepEqual(faults([{ from: 'h/value', to: 'm/places' }]), ['the connection "h/value" → "m/places": 1.5 is not a whole number']);
});
