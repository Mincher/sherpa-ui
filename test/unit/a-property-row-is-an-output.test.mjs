/**
 * A PROPERTY ROW IS AN OUTPUT — Will, 2026-11-06 (TODO 835): "The Collection node should be split into 2 distinct Sort, and
 * Group. Sort and Group should be in an Organise category. The Count option, from Collection, should be a property row on any
 * node that could provide it. A property row is an output only row in a node that provides a property (raw or calculated)
 * from the node's data or calculations from it's code logic." "So 'Field' could have a 'Count' property, for example."
 * One row kind, one definition. Count was its first use; it is a Math type now. A test's properties are its Pass and Fail
 * (plan 971 §9), and an AI node's True (1 or 0) is a number one (plan 944). Sort and Group are rows of ONE Organise node now (plan 960 U4.2); a saved Collection, Sort or Group reads with
 * a fault in words: nothing converts it.
 *
 *   node --test test/unit/a-property-row-is-an-output.test.mjs
 *
 * TRAP T-a-property-row-is-an-output
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, NODE_CATEGORIES, paletteOf, resolveKind, socketType } = await import(new URL('node-kinds.js', core));
const { givenAt, readInput } = await import(new URL('node-input.js', core));
const { workflowFaults, workflowGraph, sentFrom } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));

const flow = (nodes, connections = []) => ({ v: 3, id: 'w', nodes, connections });
const source = { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } };
// Source › Field › Prompt: an AI node's True is the number property row each test reads (plan 944); a Condition has no
// True (plan 971 §9). No Model is joined, so the Prompt warns of that alone.
const field = { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'status' } };
const asked = { id: 'q', kind: 'prompt', x: 600, y: 0, values: { type: 'boolean', prompt: 'Is it active?' } };
const testing = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'q' }];
const unjoined = { q: [['model', 'Join a Model, here or to the Start']] };
const at = (g, id) => g.nodes.find((n) => n.id === id);
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

test('Organise is the one kind in its category, Sort and Group its rows; the Collection family and its Count type are gone', () => {
  assert.deepEqual([NODE_KINDS.collection, NODE_KINDS.count, NODE_KINDS.sort, NODE_KINDS.group], [undefined, undefined, undefined, undefined]);
  assert.ok(!NODE_CATEGORIES.includes('Collections') && NODE_CATEGORIES.indexOf('Organise') === NODE_CATEGORIES.indexOf('Time') + 1);
  assert.deepEqual(paletteOf(NODE_KINDS).find((g) => g.category === 'Organise').items.map((i) => i.id), ['organise']);
  // It needs rows on its header, no Field there, has no types, and sends its rows from its Rows row (plan 960 U4.2).
  const kind = resolveKind(NODE_KINDS.organise);
  assert.deepEqual([kind.types, kind.needs, kind.input, kind.branches, kind.rows[0].name], [undefined, 'rows', 'any', undefined, 'rows']);
  // Its fields are its own rows, each taking a value in.
  assert.deepEqual(kind.rows.slice(1).map((r) => [r.name, r.input]), ['sort', 'direction', 'group', 'search', 'primary', 'secondary', 'segments'].map((n) => [n, 'value']));
  // A saved Collection, Sort or Group reads with today's fault: nothing converts it (a clean system).
  assert.deepEqual(workflowFaults(flow([{ id: 'old', kind: 'collection', x: 0, y: 0, values: { type: 'sort' } }])), ['the node "old" is of the kind "collection", which is not one']);
  for (const old of ['sort', 'group']) assert.deepEqual(workflowFaults(flow([{ id: 'old', kind: old, x: 0, y: 0 }])), [`the node "old" is of the kind "${old}", which is not one`]);
});

test('a property row is output only: no control, no input, no value; one definition, a test\'s Pass and Fail, an AI node\'s True (plans 944, 971 §9)', () => {
  // A test's properties are the rows it sends, Pass and Fail (plan 971); it has no True (plan 971 §9).
  const props = (kind) => kind.rows.filter((r) => r.property && r.gives !== 'rows');
  for (const type of ['eq', 'between', 'not', 'empty']) {
    const kind = resolveKind(NODE_KINDS.condition, type);
    assert.deepEqual([kind.rows.filter((r) => r.property && r.gives === 'rows').map((r) => r.name), props(kind)], [['pass', 'fail'], []], type);
  }
  // An AI node that expects True/false: its one property is its True, 1 or 0 (plan 944).
  for (const id of ['prompt', 'runbook', 'skill']) {
    const kind = resolveKind(NODE_KINDS[id], 'boolean');
    const [row, ...more] = props(kind);
    assert.deepEqual([more.length, row.name, row.label, row.control, row.input, row.output, row.gives], [0, 'true', 'True', undefined, undefined, 'value', 'number'], `${id} › boolean`);
    assert.deepEqual(socketType(kind, 'true', 'input'), undefined);
    assert.equal(socketType(kind, 'true', 'output'), 'value');
  }
  // One definition: the very same row object, on each.
  const same = ['prompt', 'runbook', 'skill'].map((id) => resolveKind(NODE_KINDS[id], 'boolean').rows.find((r) => r.name === 'true'));
  assert.ok(same.every((r) => r === same[0]));
  const passes = ['eq', 'between', 'and', 'not', 'empty'].map((type) => resolveKind(NODE_KINDS.condition, type).rows.find((r) => r.name === 'pass'));
  assert.ok(passes.every((r) => r === passes[0]));
  // No Count row on a Source, a Field or an Organise (plan 944). And, as every test, gives its Pass and Fail rows.
  for (const id of ['source', 'field', 'organise']) assert.deepEqual(NODE_KINDS[id].rows.filter((r) => r.property && r.name !== 'rows'), [], id);
  assert.deepEqual(resolveKind(NODE_KINDS.condition, 'and').rows.filter((r) => r.property).map((r) => [r.name, r.gives]), [['pass', 'rows'], ['fail', 'rows']]);
});

test('a property row sends a number before a run, as a Result does: it connects like any output, into a number or a value', () => {
  assert.deepEqual(givenAt({ kind: 'prompt', values: { type: 'boolean' } }, 'true', NODE_KINDS), { kind: 'number' });
  assert.deepEqual(readInput({ label: 'Value A', needs: 'number' }, { kind: 'number' }), { value: undefined });
  const w = flow([source, field, asked, { id: 'm', kind: 'math', x: 900, y: 0, values: { type: 'add', b: 1 } }], [...testing, { from: 'q/true', to: 'm/a' }]);
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  assert.deepEqual(said(g), unjoined, 'a True into a number reads as a number');
  // The drawn row is an output socket and no field.
  const row = at(g, 'q').rows.find((r) => r.name === 'true');
  assert.deepEqual([row.output, row.control, row.input, !!row.property], ['value', undefined, undefined, true]);
  // A True into a date-needing header warns, as any number does.
  const bad = flow([source, field, asked, { id: 'k', kind: 'time', x: 900, y: 0 }], [...testing, { from: 'q/true', to: 'k' }]);
  assert.deepEqual(said(workflowGraph(bad)), { ...unjoined, k: [['', 'Between takes a date; it was given a number']] });
  // The Outgoing JSON lists it among a node's outputs.
  assert.deepEqual(nodeFlow(g, 'q').outgoing.map((o) => [o.socket, o.type]), [['True', 'value']]);
});

test('a property row connects through a portal as a row, and a Custom Node takes it as an output: Save as and Ungroup keep its connection', () => {
  const math = { id: 'm', kind: 'math', x: 1200, y: 0, values: { type: 'add' } };
  const nodes = [source, field, asked, { id: 'in', kind: 'portal', x: 300, y: 300, values: { type: 'in', name: 'n' } }, { id: 'out', kind: 'portal', x: 600, y: 300, values: { type: 'out', name: 'n' } }, math];
  const w = flow(nodes, [...testing, { from: 'q/true', to: 'in' }, { from: 'out/@q/true', to: 'm/a' }]);
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  assert.deepEqual(at(g, 'out').rows.filter((r) => r.name.startsWith('@')).map((r) => [r.label, r.output]), [['Prompt › True', 'value']]);
  assert.deepEqual(said(g), unjoined);
  assert.deepEqual(sentFrom(w, 'q/true'), { kind: 'number' });
  // Save as Custom Node on the Source, Field and Prompt: the connection over the edge is a socket; Ungroup puts it back.
  const lone = flow([source, field, asked, math], [...testing, { from: 'q/true', to: 'm/a' }]);
  const made = groupNodes(lone, ['s', 'f', 'q'], { v: 1, nodes: {} }, { label: 'Tested' });
  assert.ok(!('fault' in made), made.fault);
  assert.deepEqual(made.library.nodes[made.id].outputs.filter((o) => o.label === 'Prompt › True').map((o) => o.type), ['value']);
  const back = ungroupUse(made.workflow, made.use, made.library);
  assert.deepEqual(back.workflow.connections.map((r) => `${r.from} → ${r.to}`), ['s/rows → f', 'f/field → q', 'q/true → m/a']);
});

test('a property gives a value or an object: a number, text or boolean a circle; a row, rows or a record a diamond; True is a number like any other (Will, 2026-11-06)', async () => {
  const { propertyRow } = await import(new URL('node-kinds.js', core));
  const sockets = Object.fromEntries(['number', 'value', 'boolean', 'object', 'list', 'rows', 'field'].map((g) => [g, propertyRow('p', 'P', g).output]));
  assert.deepEqual(sockets, { number: 'value', value: 'value', boolean: 'boolean', object: 'object', list: 'object', rows: 'object', field: 'object' });
  // An AI node's True, 1 or 0 (plan 944).
  assert.deepEqual(propertyRow('true', 'True'), { name: 'true', label: 'True', output: 'value', gives: 'number', property: true });
  // An object property connections into an input that takes an object, and a boolean one into a boolean's.
  const kinds = { ...NODE_KINDS, hold: { heading: 'Hold', icon: 'folder', input: 'any', rows: [propertyRow('first', 'First', 'rows'), propertyRow('empty', 'Empty', 'boolean')], model: 'hold', graphs: ['workflow'] } };
  const w = flow([source, { id: 'h', kind: 'hold', x: 0, y: 0 }, { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'status' } }, { id: 'a', kind: 'condition', x: 300, y: 300, values: { type: 'and' } }],
    [{ from: 's/rows', to: 'h' }, { from: 'h/first', to: 'f' }, { from: 'h/empty', to: 'a' }]);
  assert.deepEqual(workflowFaults(w, kinds), []);
  assert.deepEqual(said(workflowGraph(w, {}, kinds)), {});
});

test('a graph with a fault does not save: checkWorkflow says no, in words, for a saved collection and for a connection from a node that has no True', async () => {
  const { checkWorkflow } = await import(new URL('workflow.js', core));
  const { setReportSink } = await import(new URL('report.js', core)).catch(() => ({}));
  const old = flow([{ id: 'old', kind: 'collection', x: 0, y: 0, values: { type: 'sort' } }]);
  const noTrue = flow([source, { id: 'm', kind: 'math', x: 300, y: 0, values: { type: 'add' } }, { id: 'k', kind: 'organise', x: 600, y: 0 }], [{ from: 's/rows', to: 'k' }, { from: 'm', to: 'k' }]);
  void setReportSink;
  assert.deepEqual(workflowFaults(old), ['the node "old" is of the kind "collection", which is not one']);
  assert.match(workflowFaults(noTrue).join('; '), /a connection leaves "m", which is no output socket/);
  assert.deepEqual([checkWorkflow(old), checkWorkflow(noTrue), checkWorkflow(flow([source]))], [false, false, true]);
});
