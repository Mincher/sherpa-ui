/**
 * A FIELD IS A NODE — Will, 2026-11-05 (TODO 783): "I think that 'Field' is common enough to be a standalone node
 * rather than part of 'Condition' nodes. The Graph chain would, at it's simplest, would then be Source>Field>
 * Condition>Output." Pick became Field (D1): rows in, a column out, `{ rows, field }`, an object with a finer given
 * (D2); one record in, that field's value. What fits a column is one table in `readInput`; a field the rows lack
 * warns and sends nothing, as a Value into its header does (D8). Nothing is a fault: Save does not wait.
 *
 *   node --test test/unit/a-field-is-a-node.test.mjs
 *
 * TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, kindIn, paletteOf } = await import(new URL('node-kinds.js', core));
const { columnOf, fieldWords, readInput } = await import(new URL('node-input.js', core));
const { sentFrom, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const facts = { fields: { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' }, joined: { label: 'Joined', type: 'date' } } };
const store = { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } };
const field = (id, name) => ({ id, kind: 'field', x: 300, y: 0, ...(name ? { values: { field: name } } : {}) });
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });
const at = (g, id) => g.nodes.find((n) => n.id === id);
/** Each node's warnings in words, by its id: none, where it has none. */
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

test('Pick became Field: one node in Variables, in both graphs; its Field row an object out; its True and False', () => {
  assert.equal(NODE_KINDS.pick, undefined);
  const kind = NODE_KINDS.field;
  assert.deepEqual([kind.heading, kind.category, kind.input, kind.needs, kind.branches, kind.graphs], ['Field', 'Variables', 'any', 'object', true, ['query', 'workflow']]);
  assert.deepEqual(kind.rows.map((r) => [r.name, r.control, r.input, r.output, r.gives]), [['field', 'field', 'value', 'object', 'field']]);
  assert.equal(kindIn(kind, 'query'), kind);
  assert.deepEqual(paletteOf(NODE_KINDS).find((g) => g.category === 'Variables').items.map((i) => i.id), ['value', 'field']);
  // A saved Pick reads with today's fault, in words: nothing converts it (D9).
  const old = flow([{ id: 'p', kind: 'pick', x: 0, y: 0, values: { field: 'status' } }], []);
  assert.deepEqual(workflowFaults(old), ['the node "p" is of the kind "pick", which is not one']);
});

test('Store → Field sends a column, { rows, field }: the field\'s name, words and type, said on its row', () => {
  const w = flow([store, field('f', 'seats')], [{ from: 's/rows', to: 'f' }]);
  assert.deepEqual(sentFrom(w, 'f/field', facts), { kind: 'field', field: { name: 'seats', label: 'Seats', type: 'number' } });
  const g = workflowGraph(w, facts);
  assert.equal(at(g, 'f').rows[0].hint, 'Seats: a number field');
  assert.deepEqual(said(g), {});
  // Its list is OPEN: the source's fields, and its own pick where they lack it.
  assert.deepEqual(at(g, 'f').rows[0].choices.map((c) => c.value), ['status', 'seats', 'joined']);
  // None typed is a text field; with nothing in, it still says its column.
  assert.equal(fieldWords({ name: 'status', label: 'Status' }), 'Status: a text field');
  assert.deepEqual(sentFrom(flow([field('f', 'status')], []), 'f/field', facts), { kind: 'field', field: { name: 'status', label: 'Status' } });
  // A Value routed into its Field row drives the pick, marked Custom (D7 of plan 713).
  const driven = flow([store, field('f', 'status'), { id: 'v', kind: 'value', x: 0, y: 200, values: { value: 'joined' } }], [{ from: 's/rows', to: 'f' }, { from: 'v/value', to: 'f/field' }]);
  assert.equal(sentFrom(driven, 'f/field', facts).field.name, 'joined');
  assert.deepEqual([at(workflowGraph(driven, facts), 'f').rows[0].value, at(workflowGraph(driven, facts), 'f').rows[0].custom], ['joined', true]);
});

test('a column fits what takes a field, rows, an object or a list; numbers where it is a number, a date where it is a date', () => {
  const nodes = [
    store, field('seats', 'seats'), field('status', 'status'), field('joined', 'joined'),
    { id: 'c', kind: 'condition', x: 600, y: 0 }, { id: 'count', kind: 'collection', x: 600, y: 200, values: { type: 'count' } },
    { id: 'avg', kind: 'math', x: 600, y: 400, values: { type: 'average' } }, { id: 'time', kind: 'time', x: 600, y: 600 },
    { id: 'end', kind: 'output', x: 900, y: 0 },
  ];
  const into = (seats, joined) => flow(nodes, [
    ...['seats', 'status', 'joined'].map((f) => ({ from: 's/rows', to: f })),
    { from: `${seats}/field`, to: 'c' }, { from: `${seats}/field`, to: 'count' }, { from: `${seats}/field`, to: 'avg/values' },
    { from: `${joined}/field`, to: 'time' }, { from: `${seats}/field`, to: 'end' },
  ]);
  assert.deepEqual(said(workflowGraph(into('seats', 'joined'), facts)), {}, 'one Field into several nodes: each reads the column');
  assert.deepEqual(said(workflowGraph(into('status', 'status'), facts)), {
    avg: [['values', 'Values takes a list of numbers; it was given the Status column']],
    time: [['', 'Between takes a date; it was given the Status column']],
  });
  assert.deepEqual(workflowFaults(into('status', 'status'), NODE_KINDS, facts), [], 'a warning, never a fault');
});

test('a column is no ONE value: Add\'s Value A warns, unless one record came in, which sends that field\'s value', () => {
  const add = { id: 'add', kind: 'math', x: 600, y: 0, values: { type: 'add' } };
  const w = flow([store, field('f', 'seats'), add], [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'add/a' }]);
  assert.deepEqual(said(workflowGraph(w, facts)), { add: [['a', 'Value A takes a number; it was given the Seats column']] });
  // One record: an object that is not rows. Its Field sends the value, a number for a number field.
  const kinds = { ...NODE_KINDS, record: { heading: 'Record', icon: 'flag', rows: [{ name: 'out', label: 'Record', output: 'object' }], model: 'record', graphs: ['workflow'] } };
  const one = flow([{ id: 'r', kind: 'record', x: 0, y: 0 }, field('f', 'seats'), add], [{ from: 'r/out', to: 'f' }, { from: 'f/field', to: 'add/a' }]);
  assert.deepEqual(sentFrom(one, 'f/field', facts, kinds), { kind: 'number' });
  assert.deepEqual(said(workflowGraph(one, facts, kinds)), {});
  assert.deepEqual(columnOf({ name: 'status' }, { kind: 'object' }), { kind: 'value' });
  assert.equal(readInput({ label: 'Sort', needs: 'field' }, { kind: 'rows' }).warning, 'Sort takes a field; it was given rows: route a Field in');
});

test('what it cannot use warns and sends nothing: a Value into its header, a field the rows do not have', () => {
  const avg = { id: 'avg', kind: 'math', x: 600, y: 0, values: { type: 'average' } };
  const value = { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'active' } };
  const header = flow([value, field('f', 'seats'), avg], [{ from: 'v/value', to: 'f' }, { from: 'f/field', to: 'avg/values' }]);
  assert.deepEqual(said(workflowGraph(header, facts)), { f: [['', 'Field takes an object; it was given "active"']] }, 'nothing reaches the Average');
  assert.equal(sentFrom(header, 'f/field', facts), undefined);
  const stranger = flow([store, field('f', 'nope'), avg], [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'avg/values' }]);
  const g = workflowGraph(stranger, facts);
  assert.deepEqual(said(g), { f: [['field', '"nope" is not a field of the rows that come in']] });
  assert.deepEqual([sentFrom(stranger, 'f/field', facts), at(g, 'f').rows[0].hint, at(g, 'f').rows[0].value], [undefined, undefined, 'nope']);
  assert.deepEqual(workflowFaults(stranger, NODE_KINDS, facts), [], 'an open list: no fault, Save does not wait (D8)');
  // With no fields known, every pick is the source's own: a text column, then.
  assert.equal(at(workflowGraph(stranger, {}), 'f').warnings, undefined);
});

test('Sort, Group by and Tag › Includes take a Field on their header, and have no Field row; Count takes rows or a Field (D5)', () => {
  const field = { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'status' } };
  const node = (id, kind, type) => ({ id, kind, x: 600, y: 0, ...(type ? { values: { type } } : {}) });
  const nodes = [store, field, node('sort', 'collection', 'sort'), node('group', 'collection', 'group'), node('count', 'collection', 'count'), node('tag', 'tag')];
  for (const n of nodes.slice(2)) assert.ok(!workflowGraph(flow([n], [])).nodes[0].rows.some((r) => r.name === 'field'), `${n.id} has no Field row`);
  const fed = flow(nodes, [{ from: 's/rows', to: 'f' }, ...['sort', 'group', 'count', 'tag'].map((to) => ({ from: 'f/field', to }))]);
  assert.deepEqual(said(workflowGraph(fed, facts)), {}, 'each takes the Field');
  // Rows with no Field: Sort, Group by and Tag warn, and say what to route; Count counts them.
  const bare = flow(nodes, ['sort', 'group', 'count', 'tag'].map((to) => ({ from: 's/rows', to })));
  assert.deepEqual(said(workflowGraph(bare, facts)), {
    sort: [['', 'Sort takes a field; it was given rows: route a Field in']],
    group: [['', 'Group by takes a field; it was given rows: route a Field in']],
    tag: [['', 'Tag takes a field; it was given rows: route a Field in']],
  });
  // Each passes the rows on from its Rows row, as the Field carries them.
  for (const id of ['sort', 'group', 'tag']) assert.deepEqual(sentFrom(fed, `${id}/rows`, facts), { kind: 'rows' }, id);
  // A Tag's closed list is the Field's values: free with none known, closed where they are.
  const values = { ...facts, values: { status: ['active', 'trial'] } };
  const tags = (f) => workflowGraph(fed, f).nodes.find((n) => n.id === 'tag').rows.find((r) => r.name === 'value');
  assert.deepEqual([tags(facts).closed, tags(values).closed, tags(values).choices.map((c) => c.value)], [undefined, true, ['active', 'trial']]);
  const stranger = { ...fed, nodes: fed.nodes.map((n) => (n.id === 'tag' ? { ...n, values: { value: ['gold'] } } : n)) };
  assert.deepEqual(workflowFaults(stranger, NODE_KINDS, values), ['the node "tag"\'s Tags: "gold" is not a value of Status']);
  // A field row a Sort held before is no row now: nothing converts it (D9).
  assert.deepEqual(workflowFaults(flow([{ ...node('old', 'collection', 'sort'), values: { type: 'sort', field: 'status' } }], [])), ['the node "old" holds a value for "field", a row its kind has not']);
});
