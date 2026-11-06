/**
 * A PROPERTY ROW IS AN OUTPUT — Will, 2026-11-06 (TODO 835): "The Collection node should be split into 2 distinct Sort, and
 * Group. Sort and Group should be in an Organise category. The Count option, from Collection, should be a property row on any
 * node that could provide it. A property row is an output only row in a node that provides a property (raw or calculated)
 * from the node's data or calculations from it's code logic." "So 'Field' could have a 'Count' property, for example."
 * One row kind, one definition; Count is its first use. Sort and Group are kinds of their own, in Organise; a saved
 * Collection reads with a fault in words: nothing converts it.
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

const flow = (nodes, routes = []) => ({ v: 2, id: 'w', nodes, routes });
const source = { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } };
const at = (g, id) => g.nodes.find((n) => n.id === id);
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

test('Sort and Group are kinds of their own in Organise; the Collection family and its Count type are gone', () => {
  assert.deepEqual([NODE_KINDS.collection, NODE_KINDS.count], [undefined, undefined]);
  assert.ok(!NODE_CATEGORIES.includes('Collections') && NODE_CATEGORIES.indexOf('Organise') === NODE_CATEGORIES.indexOf('Time') + 1);
  assert.deepEqual(paletteOf(NODE_KINDS).find((g) => g.category === 'Organise').items.map((i) => i.id), ['sort', 'group']);
  // Each takes the Field it works on on its header (plan 783 D5), has no types, and sends its rows from its Rows row.
  for (const id of ['sort', 'group']) {
    const kind = resolveKind(NODE_KINDS[id]);
    assert.deepEqual([kind.types, kind.needs, kind.input, kind.branches, kind.rows[0].name], [undefined, 'field', 'any', undefined, 'rows'], id);
  }
  assert.deepEqual(NODE_KINDS.sort.rows.map((r) => r.name), ['rows', 'direction']);
  // A saved Collection reads with today's fault: nothing converts it (a clean system).
  assert.deepEqual(workflowFaults(flow([{ id: 'old', kind: 'collection', x: 0, y: 0, values: { type: 'sort' } }])), ['the node "old" is of the kind "collection", which is not one']);
});

test('a property row is output only: no control, no input, no value; one definition, on a Source, a Field, a Group and a Condition\'s comparisons', () => {
  const props = (kind) => kind.rows.filter((r) => r.property && r.name !== 'rows');
  for (const [id, type] of [['source'], ['field'], ['group'], ['condition', 'eq'], ['condition', 'between']]) {
    const kind = resolveKind(NODE_KINDS[id], type);
    const [row, ...more] = props(kind);
    assert.deepEqual([more.length, row.name, row.label, row.control, row.input, row.output, row.gives], [0, 'count', 'Count', undefined, undefined, 'value', 'number'], id);
    assert.deepEqual(socketType(kind, 'count', 'input'), undefined);
    assert.equal(socketType(kind, 'count', 'output'), 'value');
  }
  // One definition: the very same row object, on each.
  const same = ['source', 'field', 'group'].map((id) => NODE_KINDS[id].rows.find((r) => r.property && r.name !== 'rows'));
  assert.ok(same.every((r) => r === same[0]));
  // Not where a count means nothing: a Sort is the rows it was given; And and Or join booleans.
  assert.deepEqual([NODE_KINDS.sort.rows, resolveKind(NODE_KINDS.condition, 'and').rows].flat().filter((r) => r.property && r.name !== 'rows'), []);
});

test('a property row sends a number before a run, as a Result does: it routes like any output, into a number or a value', () => {
  assert.deepEqual(givenAt({ kind: 'source' }, 'count', NODE_KINDS), { kind: 'number' });
  assert.deepEqual(readInput({ label: 'Value A', needs: 'number' }, { kind: 'number' }), { value: undefined });
  const w = flow([source, { id: 'm', kind: 'math', x: 300, y: 0, values: { type: 'add' } }, { id: 'f', kind: 'field', x: 300, y: 300, values: { field: 'status' } }],
    [{ from: 's/count', to: 'm/a' }, { from: 's/rows', to: 'f' }, { from: 'f/count', to: 'm/b' }]);
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  assert.deepEqual(said(g), {}, 'a count into a number reads as a number');
  // The drawn row is an output socket and no field.
  const row = at(g, 's').rows.find((r) => r.name === 'count');
  assert.deepEqual([row.output, row.control, row.input, !!row.property], ['value', undefined, undefined, true]);
  // A count into a field-needing header warns, as any number does.
  const bad = flow([source, { id: 'k', kind: 'sort', x: 300, y: 0 }], [{ from: 's/count', to: 'k' }]);
  assert.deepEqual(said(workflowGraph(bad)), { k: [['', 'Sort takes a field; it was given a number']] });
  // The Outgoing JSON lists it among a node's outputs.
  assert.deepEqual(nodeFlow(g, 's').outgoing.map((o) => [o.socket, o.type]), [['Results', 'object'], ['Count', 'value']]);
});

test('a property row routes through a portal as a row, and a Custom Node takes it as an output: Save as and Ungroup keep its route', () => {
  const nodes = [source, { id: 'in', kind: 'portal', x: 300, y: 0, values: { type: 'in', name: 'n' } }, { id: 'out', kind: 'portal', x: 600, y: 0, values: { type: 'out', name: 'n' } },
    { id: 'm', kind: 'math', x: 900, y: 0, values: { type: 'add' } }];
  const w = flow(nodes, [{ from: 's/count', to: 'in' }, { from: 'out/@s/count', to: 'm/a' }]);
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  assert.deepEqual(at(g, 'out').rows.filter((r) => r.name.startsWith('@')).map((r) => [r.label, r.output]), [['Source › Count', 'value']]);
  assert.deepEqual(said(g), {});
  assert.deepEqual(sentFrom(w, 's/count'), { kind: 'number' });
  // Save as Custom Node on the Source and the Math: the route over the edge is a socket; Ungroup puts it back.
  const lone = flow([source, nodes[3]], [{ from: 's/count', to: 'm/a' }]);
  const made = groupNodes(lone, ['s'], { v: 1, nodes: {} }, { label: 'Counted' });
  assert.ok(!('fault' in made), made.fault);
  assert.deepEqual(made.library.nodes[made.id].outputs.filter((o) => o.label === 'Source › Count').map((o) => o.type), ['value']);
  const back = ungroupUse(made.workflow, made.use, made.library);
  assert.deepEqual(back.workflow.routes.map((r) => `${r.from} → ${r.to}`), ['s/count → m/a']);
});

test('a property gives a value or an object: a number, text or boolean a circle; a row, rows or a record a diamond; Count is a number like any other (Will, 2026-11-06)', async () => {
  const { propertyRow } = await import(new URL('node-kinds.js', core));
  const sockets = Object.fromEntries(['number', 'value', 'boolean', 'object', 'list', 'rows', 'field'].map((g) => [g, propertyRow('p', 'P', g).output]));
  assert.deepEqual(sockets, { number: 'value', value: 'value', boolean: 'boolean', object: 'object', list: 'object', rows: 'object', field: 'object' });
  assert.deepEqual(propertyRow('count', 'Count'), { name: 'count', label: 'Count', output: 'value', gives: 'number', property: true });
  // An object property routes into an input that takes an object, and a boolean one into a boolean's.
  const kinds = { ...NODE_KINDS, hold: { heading: 'Hold', icon: 'folder', input: 'any', rows: [propertyRow('first', 'First', 'rows'), propertyRow('empty', 'Empty', 'boolean')], model: 'hold', graphs: ['workflow'] } };
  const w = flow([source, { id: 'h', kind: 'hold', x: 0, y: 0 }, { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'status' } }, { id: 'a', kind: 'condition', x: 300, y: 300, values: { type: 'and' } }],
    [{ from: 's/rows', to: 'h' }, { from: 'h/first', to: 'f' }, { from: 'h/empty', to: 'a' }]);
  assert.deepEqual(workflowFaults(w, kinds), []);
  assert.deepEqual(said(workflowGraph(w, {}, kinds)), {});
});

test('a graph with a fault does not save: checkWorkflow says no, in words, for a saved collection and for a route from a node that has no True', async () => {
  const { checkWorkflow } = await import(new URL('workflow.js', core));
  const { setReportSink } = await import(new URL('report.js', core)).catch(() => ({}));
  const old = flow([{ id: 'old', kind: 'collection', x: 0, y: 0, values: { type: 'sort' } }]);
  const noTrue = flow([source, { id: 'm', kind: 'math', x: 300, y: 0, values: { type: 'add' } }, { id: 'k', kind: 'sort', x: 600, y: 0 }], [{ from: 's/rows', to: 'k' }, { from: 'm', to: 'k' }]);
  void setReportSink;
  assert.deepEqual(workflowFaults(old), ['the node "old" is of the kind "collection", which is not one']);
  assert.match(workflowFaults(noTrue).join('; '), /a route leaves "m", which is no output socket/);
  assert.deepEqual([checkWorkflow(old), checkWorkflow(noTrue), checkWorkflow(flow([source]))], [false, false, true]);
});
