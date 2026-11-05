/**
 * A BOOLEAN READS AS WHAT ITS INPUT NEEDS — Will, 2026-11-05 (TODO 781): "Where booleans need to be a number then
 * nodes should convert True/False to 1/0. Where they need to be a String (or part of a larger JSON object) then the
 * inverse should be handled." One table, `COERCIONS`, beside `INPUT_WORDS`: True and False read as 1 and 0 by a
 * number, as the words by a value, as true and false in JSON; a number reads as a boolean, 0 False and any other
 * True (D2), and so do the words true and false; other text says no boolean, reads null and warns. A coerced value
 * is used, and no warning. A node never coerces by itself.
 *
 *   node --test test/unit/a-boolean-reads-as-its-need.test.mjs
 *
 * TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { COERCIONS, INPUT_WORDS, coerce, readInput } = await import(new URL('node-input.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const data = await import(new URL('../../data.js', core));

const yes = { id: 'yes', kind: 'value', x: 0, y: 0, values: { type: 'boolean', value: 'true' } };
const no = { id: 'no', kind: 'value', x: 0, y: 200, values: { type: 'boolean', value: 'false' } };
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });
const at = (g, id) => g.nodes.find((n) => n.id === id);
const row = (g, id, name) => at(g, id).rows.find((r) => r.name === name);

test('ONE table: each cell says what an input needs, what it is given, what it reads, and in words', () => {
  assert.deepEqual(COERCIONS.map((c) => `${c.needs} ← ${c.given}`), ['number ← boolean', 'value ← boolean', 'json ← boolean', 'boolean ← number', 'boolean ← value']);
  for (const c of COERCIONS) {
    assert.equal(typeof c.said, 'string');
    assert.ok(c.needs === 'json' || c.needs in INPUT_WORDS, `${c.needs} is a need INPUT_WORDS says`);
  }
  assert.equal(data.COERCIONS, COERCIONS, 'sherpa-ui/data exports the one table');
  assert.equal(typeof data.coerce, 'function');
});

test('each cell, as `coerce` reads it: what it reads of a held value, none yet of a run\'s, and none of what it cannot read', () => {
  const cells = [
    ['number', { kind: 'boolean', value: 'true' }, 1], ['number', { kind: 'boolean', value: 'false' }, 0], ['number', { kind: 'boolean', value: true }, 1],
    ['value', { kind: 'boolean', value: 'true' }, 'true'], ['value', { kind: 'boolean', value: false }, 'false'],
    ['json', { kind: 'boolean', value: 'true' }, true], ['json', { kind: 'boolean', value: 'false' }, false],
    ['boolean', { kind: 'value', value: '1' }, true], ['boolean', { kind: 'value', value: 0 }, false], ['boolean', { kind: 'number', value: 2 }, true], ['boolean', { kind: 'value', value: '0.5' }, true],
    ['boolean', { kind: 'value', value: 'TRUE' }, true], ['boolean', { kind: 'value', value: ' false ' }, false],
  ];
  for (const [needs, reached, want] of cells) assert.deepEqual(coerce(needs, reached), { value: want }, `${needs} ← ${JSON.stringify(reached)}`);
  // A run's boolean, or a run's number: read when it runs, no answer yet, and no warning.
  assert.deepEqual([coerce('number', { kind: 'boolean' }), coerce('value', { kind: 'boolean' }), coerce('boolean', { kind: 'number' })], [{ value: undefined }, { value: undefined }, { value: undefined }]);
  // Text that says no boolean; a boolean into rows; a list into a number: no cell reads them.
  assert.deepEqual([coerce('boolean', { kind: 'value', value: 'yes' }), coerce('rows', { kind: 'boolean' }), coerce('number', { kind: 'list', value: ['1'] })], [undefined, undefined, undefined]);
  // readInput coerces before it warns: a coerced value is used, and says nothing.
  assert.deepEqual(readInput({ label: 'Value A', needs: 'number' }, { kind: 'boolean', value: 'true' }), { value: 1 });
  assert.deepEqual(readInput({ label: 'Group', needs: 'boolean' }, { kind: 'value', value: 'yes' }), { value: null, warning: 'Group takes a boolean; it was given "yes"' });
});

test('in a graph: True into Math › Value A reads 1, False 0, no warning; a run\'s True, no warning either', () => {
  const w = flow([yes, no, { id: 'm', kind: 'math', x: 360, y: 0 }], [{ from: 'yes/value', to: 'm/a' }, { from: 'no/value', to: 'm/b' }]);
  const g = workflowGraph(w);
  assert.deepEqual([workflowFaults(w), at(g, 'm').warnings, row(g, 'm', 'a').value, row(g, 'm', 'b').value], [[], undefined, '1', '0']);
  const flowIn = nodeFlow(g, 'm').incoming;
  assert.deepEqual(flowIn.filter((s) => s.socket.startsWith('Value')).map((s) => s.value), ['1', '0']);
  const run = flow([{ id: 's', kind: 'store', x: 0, y: 0 }, { id: 'm', kind: 'math', x: 360, y: 0 }], [{ from: 's', to: 'm/a' }]);
  assert.equal(at(workflowGraph(run), 'm').warnings, undefined);
});

test('in a graph: True into a text row reads the word, never 1; written into JSON it is true, never 1 or "true"', () => {
  const w = flow([yes, { id: 't', kind: 'text', x: 360, y: 0 }], [{ from: 'yes/value', to: 't/a' }]);
  const g = workflowGraph(w);
  assert.deepEqual([at(g, 't').warnings, row(g, 't', 'a').value], [undefined, 'true']);
  const out = nodeFlow(g, 'yes').outgoing.find((s) => s.socket === 'Value');
  assert.equal(out.carries, true, 'the Outgoing JSON writes a boolean as one');
  assert.equal(nodeFlow(workflowGraph(flow([no], [])), 'no').outgoing.find((s) => s.socket === 'Value').carries, false);
});

test('in a graph: a number and the words read as a boolean where one is needed; other text reads null and warns', () => {
  const v = (id, value, type) => ({ id, kind: 'value', x: 0, y: 0, values: { value, ...(type ? { type } : {}) } });
  const c = { id: 'c', kind: 'condition', x: 360, y: 0, values: { field: 'status', op: 'eq', value: 'active' } };
  const into = (src) => workflowGraph(flow([src, c], [{ from: `${src.id}/value`, to: 'c/group-2' }]));
  assert.deepEqual([row(into(v('two', '2', 'integer')), 'c', 'group-2').value, at(into(v('two', '2', 'integer')), 'c').warnings], ['true', undefined]);
  assert.deepEqual([row(into(v('zero', '0', 'integer')), 'c', 'group-2').value, row(into(v('word', 'FALSE')), 'c', 'group-2').value], ['false', 'false']);
  assert.deepEqual(at(into(v('maybe', 'maybe')), 'c').warnings, [{ row: 'group-2', words: 'Group takes a boolean; it was given "maybe"' }]);
  // A text Value that says "true" into a number: text is typed first, so it is no boolean, and no number.
  const text = workflowGraph(flow([v('t', 'true'), { id: 'm', kind: 'math', x: 360, y: 0 }], [{ from: 't/value', to: 'm/a' }]));
  assert.deepEqual(at(text, 'm').warnings, [{ row: 'a', words: 'Value A takes a number; it was given "true"' }]);
});
