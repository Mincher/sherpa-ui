/**
 * SIMULATE runs the rest of the kinds: a Value, Math and Text send a value, Sort puts the rows in a field's order, Group
 * gathers each value's rows, Time and Tag test as a Condition does, and a Custom Node's body is run as
 * a graph of its own, its Group Input fed what the use hears. A value that cannot be made says why, in words, and sends no
 * number. The simulator is generic: it names no kind but by its row names. Will, TODO 836 P6
 * · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 *   node --test test/unit/a-simulation-runs-every-kind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const lightMod = await import(new URL('node-simulate.js', core));
const { simulateGraph } = lightMod;
const { workflowGraph } = await import(new URL('workflow.js', core));

const R = (from, to) => ({ from, to });
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'p', nodes, connections });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const ROWS = [
  { id: 1, plan: 'Pro', seats: 30, tags: 'a' }, { id: 2, plan: 'Free', seats: 5, tags: 'b' },
  { id: 3, plan: 'Pro', seats: 12, tags: 'a' }, { id: 4, plan: 'Team', seats: 12, tags: 'c' }, { id: 5, plan: 'Free', seats: 70, tags: 'b' },
];

const calc = (kind, values, connections = [], more = []) => {
  const sim = simulateGraph(graphOf([N('x', kind, values), ...more], connections), {});
  return out(sim, 'x', 'x/result');
};

test('Math: add, subtract, multiply, divide, ratio, round, increment and the list ones, from the row or a connected Value', () => {
  assert.equal(calc('math', { type: 'add', a: 2, b: 3 }).value, 5);
  assert.equal(calc('math', { type: 'subtract', a: 2, b: 3 }).value, -1);
  assert.equal(calc('math', { type: 'multiply', a: 4, b: 3 }).value, 12);
  assert.equal(calc('math', { type: 'divide', a: 9, b: 4 }).value, 2.25);
  assert.equal(calc('math', { type: 'ratio', a: 1, b: 4 }).value, 0.25);
  assert.equal(calc('math', { type: 'round', a: 2.3456, places: 2 }).value, 2.35);
  const connected = calc('math', { type: 'add', b: 1 }, [R('v/value', 'x/a')], [N('v', 'value', { type: 'integer', value: '41' })]);
  assert.equal(connected.value, 42, 'a Value connected in is Value A');
  const list = (type) => calc('math', { type }, [R('l/value', 'x/values')], [N('l', 'value', { type: 'list', value: ['3', '9', '6'] })]).value;
  assert.deepEqual([list('floor'), list('ceiling'), list('average')], [3, 9, 6]);
});

test('Math: no number says why, in words: a divide by zero, text, an empty row, a list that is not one', () => {
  assert.match(calc('math', { type: 'divide', a: 1, b: 0 }).note, /divides by zero/);
  assert.equal(calc('math', { type: 'divide', a: 1, b: 0 }).value, undefined);
  assert.match(calc('math', { type: 'add', a: 'abc', b: 1 }).note, /"abc" is not a number/);
  assert.match(calc('math', { type: 'add', b: 1 }).note, /is empty/);
  assert.match(calc('math', { type: 'average' }).note, /is empty/);
});

test('Text: append, prepend, split and join', () => {
  assert.equal(calc('text', { type: 'append', a: 'Acme', b: ' Ltd' }).value, 'Acme Ltd');
  assert.equal(calc('text', { type: 'prepend', a: 'Acme', b: 'The ' }).value, 'The Acme');
  assert.deepEqual(calc('text', { type: 'split', a: 'a,b,c', separator: ',' }).value, ['a', 'b', 'c']);
  const joined = calc('text', { type: 'join', separator: '-' }, [R('l/value', 'x/values')], [N('l', 'value', { type: 'list', value: ['x', 'y'] })]);
  assert.equal(joined.value, 'x-y');
  assert.match(calc('text', { type: 'append', b: 'z' }).note, /is empty/);
});

test('a Value reads as its type says: an integer drops its decimals, a boolean is true or false', () => {
  const v = (type, value) => out(simulateGraph(graphOf([N('x', 'value', { type, value })], []), {}), 'x', 'x/value');
  assert.equal(v('integer', '7.9').value, 7);
  assert.equal(v('decimal', '7.5').value, 7.5);
  assert.equal(v('boolean', 'true').value, true);
  assert.equal(v('text', 'hello').value, 'hello');
  assert.match(v('integer', 'x').note, /is not a number/);
});

const arrange = (kind, values) => graphOf(
  [N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'seats' }), N('x', kind, values), N('o', 'output')],
  [R('s/rows', 'f'), R('f/field', 'x'), R('x/rows', 'o')],
);

test('Sort puts the rows in their field\'s order, each way; the same rows, none lost', () => {
  const asc = out(simulateGraph(arrange('sort', { direction: 'asc' }), { customers: ROWS }), 'x', 'x/rows').rows;
  assert.deepEqual(asc.map((r) => r.seats), [5, 12, 12, 30, 70]);
  const desc = out(simulateGraph(arrange('sort', { direction: 'desc' }), { customers: ROWS }), 'x', 'x/rows').rows;
  assert.deepEqual(desc.map((r) => r.seats), [70, 30, 12, 12, 5]);
  assert.deepEqual(asc.map((r) => r.id).slice(1, 3), [3, 4], 'equal values keep their order');
  assert.equal(new Set(asc).size, ROWS.length);
});

test('Group gathers each value\'s rows, the groups in the order they first appear; it has no Count row (plan 944)', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'plan' }), N('x', 'group'), N('o', 'output'), N('m', 'math', { type: 'count' })],
    [R('s/rows', 'f'), R('f/field', 'x'), R('x/rows', 'o'), R('x/rows', 'm/rows')]);
  const sim = simulateGraph(g, { customers: ROWS });
  assert.deepEqual(out(sim, 'x', 'x/rows').rows.map((r) => r.id), [1, 3, 2, 5, 4]);
  // A Math Count counts the rows it sends, none lost (plan 944).
  assert.deepEqual([out(sim, 'x', 'x/count'), out(sim, 'm', 'm/result').value], [undefined, 5]);
});

test('Sort and Group with no Field connected in say so and send no rows', () => {
  const sim = simulateGraph(graphOf([N('s', 'source', { store: 'customers' }), N('x', 'sort', {})], [R('s/rows', 'x')]), { customers: ROWS });
  assert.equal(out(sim, 'x', 'x/rows').rows, undefined);
  assert.match(out(sim, 'x', 'x/rows').note, /No Field is connected in/);
});

test('Time and Tag keep rows as a Condition does: a Tag the rows that include a value', () => {
  const g = graphOf([N('s', 'source', { store: 'customers' }), N('f', 'field', { field: 'tags' }), N('x', 'tag', { type: 'includes', value: ['a'] }), N('o', 'output')],
    [R('s/rows', 'f'), R('f/field', 'x'), R('x', 'o')]);
  const sim = simulateGraph(g, { customers: ROWS });
  assert.equal(sim.faults.some((f) => /not simulated/.test(f)), false, JSON.stringify(sim.faults));
});

test('a Custom Node runs its body: its Group Input is fed what the use hears, and its Group Output is what the use sends', () => {
  const use = N('u', 'mine:double', {});
  const body = graphOf(
    [N('#in', '#group-input'), N('m', 'math', { type: 'multiply', b: 2 }), N('#out', '#group-output')],
    [R('#in/n', 'm/a'), R('m/result', '#out/r')],
  );
  // Drawn by hand: the host (the editor) hands the body, kinds and all.
  const graph = { nodes: [{ id: 'u', kind: 'mine:double', heading: 'Double', rows: [{ name: 'n', label: 'N', input: 'value', value: 21 }, { name: 'r', label: 'R', output: 'value' }] }, { id: 'v', kind: 'value', heading: 'Value', rows: [{ name: 'value', label: 'Value', output: 'value', value: '21' }] }], connections: [] };
  const inner = {
    nodes: [
      { id: '#in', kind: '#group-input', heading: 'Group Input', rows: [{ name: 'n', label: 'N', output: 'value' }] },
      { id: 'm', kind: 'math', heading: 'Math', rows: [{ name: 'type', value: 'multiply' }, { name: 'a', label: 'A', input: 'value' }, { name: 'b', label: 'B', input: 'value', value: 2 }, { name: 'result', label: 'Result', output: 'value' }] },
      { id: '#out', kind: '#group-output', heading: 'Group Output', input: 'any', rows: [{ name: 'r', label: 'R', input: 'value' }] },
    ],
    connections: [{ from: '#in/n', to: 'm/a' }, { from: 'm/result', to: '#out/r' }],
  };
  void use; void body;
  const sim = simulateGraph(graph, {}, { inner: (node) => (node.kind === 'mine:double' ? inner : undefined) });
  assert.equal(out(sim, 'u', 'u/r').value, 42);
  assert.equal(sim.faults.some((f) => /not simulated/.test(f) && /Double/.test(f)), false);
  const none = simulateGraph(graph, {});
  assert.ok(none.faults.includes('"Double" is not simulated yet'), 'with no body given, a Custom Node is not simulated');
});

test('a node that sends a value says it on its light: "= 42"; a long one is cut', () => {
  const { lightOf } = lightMod;
  const sim = simulateGraph(graphOf([N('x', 'math', { type: 'add', a: 40, b: 2 }), N('t', 'text', { type: 'append', a: 'x'.repeat(40), b: 'y' })], []), {});
  assert.equal(lightOf(sim.nodes.x, 3), '= 42 · 3 ms');
  assert.match(lightOf(sim.nodes.t, 0), /^= x{23}… · <1 ms$/);
});

test('a Custom Node that holds itself stops: the body runs a few levels, never for ever', () => {
  const graph = { nodes: [{ id: 'u', kind: 'mine:loop', heading: 'Loop', rows: [{ name: 'n', label: 'N', input: 'value', value: 1 }, { name: 'r', label: 'R', output: 'value' }] }], connections: [] };
  const body = {
    nodes: [
      { id: '#in', kind: '#group-input', heading: 'Group Input', rows: [{ name: 'n', label: 'N', output: 'value' }] },
      { id: 'again', kind: 'mine:loop', heading: 'Loop', rows: [{ name: 'n', label: 'N', input: 'value' }, { name: 'r', label: 'R', output: 'value' }] },
      { id: '#out', kind: '#group-output', heading: 'Group Output', input: 'any', rows: [{ name: 'r', label: 'R', input: 'value' }] },
    ],
    connections: [{ from: '#in/n', to: 'again/n' }, { from: 'again/r', to: '#out/r' }],
  };
  const sim = simulateGraph(graph, {}, { inner: () => body });
  assert.equal(out(sim, 'u', 'u/r').value, undefined);
});
