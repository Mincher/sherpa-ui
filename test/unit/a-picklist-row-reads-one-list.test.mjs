/**
 * A PICKLIST ROW READS ONE LIST (`rowChoices`), and a Value node routed into it
 * OVERRIDES it: the row MIRRORS what comes in, read only, each pick marked
 * Custom; cut the route, and its own pick is back — the draft kept it. A
 * multi-select row (`multiple`) holds, takes and sends ONE object, a list.
 * A Value node is added for a row, and a node removed with its routes: pure
 * edits on the draft. Will, 2026-11-04 · plan 713 M6, D7, D17.
 *
 *   node --test test/unit/a-picklist-row-reads-one-list.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, fixedChoices, mirrored, resolveKind, rowChoices, socketType, typeChoices } = await import(new URL('node-kinds.js', core));
const { addCustomValue, editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { queryGraph } = await import(new URL('query-graph.js', core));
const { innerOf } = await import(new URL('node-library.js', core));

const fields = { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' } };
// A store's fields, and the same with the values Status takes: a Field reads its Source's (TODO 817).
const facts = { fieldsOf: { customers: fields } };
const valued = { fieldsOf: { customers: { ...fields, status: { ...fields.status, values: ['active', 'trial'] } } } };
const labels = (list) => list?.map((c) => c.label);

const flow = (values = {}, extra = {}) => ({
  v: 2, id: 'f',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'status', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'filter', kind: 'condition', x: 360, y: 0, values: { type: 'eq', ...values } },
    { id: 'end', kind: 'output', x: 720, y: 0 },
    { id: 'pick', kind: 'field', x: 180, y: 0, values: { field: 'status' } },
  ],
  routes: [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'filter' }, { from: 'filter/rows', to: 'end' }],
  ...extra,
});
const routed = (values) => editWorkflow(flow(values), { route: { from: 'status/value', to: 'filter/b' } });
const rowOf = (w, id, name, facts = valued) => workflowGraph(w, facts).nodes.find((n) => n.id === id).rows.find((r) => r.name === name);

test('rowChoices gives each picklist its one list; a row that is no picklist has none', () => {
  assert.deepEqual(labels(rowChoices({ control: 'field' }, { fields })), ['Status', 'Seats']);
  assert.deepEqual(labels(rowChoices({ control: 'direction' })), ['Ascending', 'Descending']);
  assert.deepEqual(labels(rowChoices({ control: 'apply' })), ['Change', 'Input']);
  assert.deepEqual(labels(rowChoices({ control: 'unit' })), ['days', 'weeks', 'months', 'years']);
  assert.deepEqual(labels(rowChoices({ control: 'span' })), ['In the last', 'In the next']);
  assert.deepEqual(labels(rowChoices({ control: 'type' }, { types: typeChoices(NODE_KINDS.value) })), ['Text', 'Integer', 'Decimal', 'Date', 'True/false', 'List']);
  assert.deepEqual(labels(rowChoices({ control: 'presentation' })).slice(0, 3), ['Default', 'Bar', 'Donut']);
  // A Store row with none starts with Pick a store, so it draws the same each time (TODO 824); one picked, only the stores.
  assert.deepEqual(rowChoices({ control: 'store' }, { stores: ['customers'] }), [{ value: '', label: 'Pick a store' }, { value: 'customers', label: 'customers' }]);
  assert.deepEqual(rowChoices({ control: 'store', value: 'customers' }, { stores: ['customers'] }), [{ value: 'customers', label: 'customers' }]);
  assert.deepEqual(rowChoices({ control: 'values' }, { values: ['a', 'b'] }).map((c) => c.value), ['a', 'b']);
  assert.equal(rowChoices({ control: 'text' }), undefined);
  assert.equal(rowChoices({}), undefined);
  assert.equal(fixedChoices('field'), undefined, 'an open list is not fixed');
  assert.equal(fixedChoices('direction').length, 2);
  // A pick the list lacks is offered, so a select shows it and nothing is lost.
  assert.deepEqual(rowChoices({ control: 'field', value: 'gone' }, { fields }).at(-1), { value: 'gone', label: 'gone' });
});

test('every workflow picklist row takes a value in; the Value node has its Type', () => {
  const kind = (id) => (id === 'filter' ? resolveKind(NODE_KINDS.condition) : ['sort', 'group'].includes(id) ? resolveKind(NODE_KINDS.collection, id) : NODE_KINDS[id]);
  for (const [id, row] of [['source', 'store'], ['field', 'field'], ['filter', 'b'], ['sort', 'direction']]) {
    assert.equal(socketType(kind(id), row, 'input'), 'value', `${id} › ${row}`);
  }
  const value = resolveKind(NODE_KINDS.value);
  assert.deepEqual(value.rows.map((r) => [r.name, r.control]), [['type', 'type'], ['value', 'text']]);
  assert.equal(value.rows[0].input, undefined, 'the Type is picked, never fed');
  // Where the Query has no route, its rows draw no socket.
  const g = queryGraph({ v: 1, scopes: {} }, { v: 1, id: 'p', source: { store: 'customers', search: ['name'], fields: { name: {} } } });
  for (const [id, name] of [['source', 'store'], ['source', 'search'], ['source', 'applyOn']]) {
    const r = g.nodes.find((n) => n.id === id).rows.find((x) => x.name === name);
    assert.deepEqual([r.input, r.output, r.editable], [undefined, undefined, undefined], `${id} › ${name} is read only, with no socket`);
    assert.ok(r.choices, `${id} › ${name} is a picklist`);
  }
});

test('the Query\'s Source › Store, Search fields, Apply on and a shared Presentation are picklists, read only', () => {
  const definition = {
    v: 1, id: 'p',
    source: { store: 'customers', search: ['name', 'email'], applyOn: 'input', fields: { name: { label: 'Name' }, email: {}, status: {} } },
  };
  const query = { v: 1, scopes: { view: { holds: [], readings: {}, presentation: { kind: 'bar', sort: 'desc' } } } };
  const g = queryGraph(query, definition, { stores: ['customers', 'orders'], components: [{ id: 'c', label: 'Chart', scope: 'view', kind: 'donut' }] });
  const row = (id, name) => g.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);
  assert.deepEqual(labels(row('source', 'store').choices), ['customers', 'orders']);
  assert.deepEqual([row('source', 'search').multiple, row('source', 'search').value], [true, ['name', 'email']]);
  assert.deepEqual(row('source', 'search').choices.map((c) => c.value), ['name', 'email', 'status']);
  assert.deepEqual([row('source', 'applyOn').value, labels(row('source', 'applyOn').choices)], ['input', ['Change', 'Input']]);
  const shown = g.nodes.find((n) => n.kind === 'presentation');
  for (const r of shown.rows.filter((x) => x.name !== 'rows')) assert.ok(r.choices && !r.editable, `${r.name} is a read only picklist`);
  assert.equal(shown.rows.find((r) => r.name === 'kind').choices.length, 5);
});

test('a Value node routed into a picklist OVERRIDES it: the row mirrors it, read only, marked Custom; cut, and its own pick is back', () => {
  const own = flow({ b: 'trial' });
  assert.deepEqual([rowOf(own, 'filter', 'b').value, rowOf(own, 'filter', 'b').custom], ['trial', undefined], 'its own pick, from the field\'s values');
  assert.deepEqual(labels(rowOf(own, 'filter', 'b').choices), ['active', 'trial']);
  const over = routed({ b: 'trial' });
  const row = rowOf(over, 'filter', 'b');
  assert.deepEqual([row.value, row.custom, row.hint], ['active', true, 'Custom value, from Value › Value']);
  assert.deepEqual(row.choices, [{ value: 'active', label: 'active Custom' }]);
  assert.equal(over.nodes[2].values.b, 'trial', 'the draft keeps its own pick under the route');
  const cut = editWorkflow(over, { cut: 'filter/b' });
  const back = rowOf(cut, 'filter', 'b');
  assert.deepEqual([back.value, back.custom, back.hint], ['trial', undefined, undefined]);
  // A value that is not in the list is Custom the same way; one no node holds waits for N4.
  assert.equal(rowOf(routed(), 'filter', 'b', facts).value, 'active', 'with no list it still mirrors');
  const sum = { ...over, nodes: [...over.nodes, { id: 'sum', kind: 'math', x: 0, y: 400 }] };
  const waiting = editWorkflow(sum, { route: { from: 'sum/result', to: 'filter/b' } });
  assert.equal(rowOf(waiting, 'filter', 'b').value, 'trial', 'a Result holds no value yet: its own shows');
  // The Type, and the node it routes: the flow is checked as it was.
  assert.deepEqual(workflowFaults(over), []);
});

test('a row a route drives that sends nothing yet, and that holds nothing, shows NOTHING and says where from: never its list\'s first choice (TODO 774)', () => {
  // Inside a Custom Node: the Group Input holds no value before a run.
  const definition = {
    v: 1, label: 'Has status',
    inputs: [{ name: 'status', label: 'Status', type: 'value' }, { name: 'way', label: 'Way', type: 'value' }],
    outputs: [{ name: 'matching', label: 'Matching', type: 'object' }],
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'pick', kind: 'field', x: 180, y: 0, values: { field: 'status' } },
      { id: 'match', kind: 'condition', x: 360, y: 0, values: { type: 'eq' } },
      { id: 'order', kind: 'collection', x: 720, y: 0, values: { type: 'sort' } },
    ],
    routes: [
      { from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'match' }, { from: '#in/status', to: 'match/b' },
      { from: '#in/way', to: 'order/direction' }, { from: 'match/rows', to: '#out/matching' },
    ],
  };
  const inside = (d = definition, facts = valued) => {
    const inner = innerOf({ id: 'use', kind: 'has-status' }, { v: 1, nodes: { 'has-status': d } });
    return (id, name) => workflowGraph(inner.workflow, facts, inner.kinds).nodes.find((n) => n.id === id).rows.find((r) => r.name === name);
  };
  // An open list (the field's values) and a fixed one (Ascending, Descending): empty, none of their choices, and where from.
  for (const [id, name, from] of [['match', 'b', 'Status'], ['order', 'direction', 'Way']]) {
    const row = inside()(id, name);
    assert.deepEqual([row.value, row.choices, row.custom, row.hint], ['', [], true, `From Group Input › ${from}`], `${id} › ${name}`);
  }
  // A typed row (no values known) is empty too, and says it.
  const typed = inside(definition, facts)('match', 'b');
  assert.deepEqual([typed.value, typed.choices, typed.hint], [undefined, undefined, 'From Group Input › Status']);
  // A row that holds its own pick still shows it, until N4 runs the flow.
  const held = { ...definition, nodes: definition.nodes.map((n) => (n.id === 'match' ? { ...n, values: { ...n.values, b: 'trial' } } : n)) };
  const own = inside(held)('match', 'b');
  assert.deepEqual([own.value, own.custom, own.hint, labels(own.choices)], ['trial', undefined, undefined, ['active', 'trial']]);
  // At the top too: a Result only a run fills.
  const sum = { ...flow(), nodes: [...flow().nodes, { id: 'sum', kind: 'math', x: 0, y: 400 }] };
  const waiting = rowOf(editWorkflow(sum, { route: { from: 'sum/result', to: 'filter/b' } }), 'filter', 'b');
  assert.deepEqual([waiting.value, waiting.choices, waiting.hint], ['', [], 'From Math › Result']);
});

test('a multi-select row holds, takes and sends ONE object: each routed pick is ticked, and Custom where its list lacks it', () => {
  const kinds = {
    ...NODE_KINDS,
    tags: { heading: 'Tags', icon: 'flag', input: 'any', rows: [{ name: 'set', label: 'Set', control: 'field', multiple: true, output: 'object' }], model: 'x', graphs: ['workflow'] },
    notify: { heading: 'Notify', icon: 'flag', input: 'any', rows: [{ name: 'to', label: 'To', control: 'field', multiple: true, input: 'object', output: 'object' }], model: 'x', graphs: ['workflow'] },
  };
  // A field row lists the fields of the Source its rows come from.
  const w = {
    v: 2, id: 'm', nodes: [
      { id: 'a', kind: 'tags', x: 0, y: 0, values: { set: ['status', 'ghost'] } },
      { id: 'b', kind: 'notify', x: 360, y: 0, values: { to: ['seats'] } },
      { id: 's', kind: 'source', x: -360, y: 0, values: { store: 'customers' } },
    ], routes: [{ from: 'a/set', to: 'b/to' }, { from: 's/rows', to: 'a' }, { from: 's/rows', to: 'b' }],
  };
  assert.deepEqual(workflowFaults(w, kinds), []);
  const row = workflowGraph(w, facts, kinds).nodes[1].rows[0];
  assert.deepEqual([row.value, row.custom, row.hint], [['status', 'ghost'], true, 'Custom values, from Tags › Set']);
  assert.deepEqual(row.choices.map((c) => [c.value, c.label]), [['status', 'Status'], ['seats', 'Seats'], ['ghost', 'ghost Custom']]);
  // Its own pick stays; cut the route and it is back, as ONE list.
  const cut = editWorkflow(w, { cut: 'b/to' }, kinds);
  assert.deepEqual(workflowGraph(cut, facts, kinds).nodes[1].rows[0].value, ['seats']);
  assert.deepEqual(editWorkflow(cut, { node: 'b', row: 'to', value: 'status' }, kinds).nodes[1].values.to, ['status'], 'an edit is one list');
  // A value is no list: a Value node's route joins (TODO 770), and To reads null and warns; no fault.
  const fed = editWorkflow(w, { route: { from: 'v/value', to: 'b/to' } }, kinds);
  const withV = { ...fed, nodes: [...fed.nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'status' } }] };
  assert.deepEqual(workflowFaults(withV, kinds).filter((f) => f.includes('"v/value"')), []);
  assert.deepEqual(workflowGraph(withV, facts, kinds).nodes[1].warnings, [{ row: 'to', words: 'To takes a list; it was given "status"' }]);
  // The set it holds must be a list.
  assert.deepEqual(workflowFaults({ ...w, nodes: [{ ...w.nodes[0], values: { set: 'status' } }, ...w.nodes.slice(1)] }, kinds), ['the node "a" holds "status" as its Set, which is no list']);
  assert.deepEqual(mirrored({ multiple: true }, [['a', 'b'], 'c'], [{ value: 'a', label: 'A' }]).value, ['a', 'b', 'c']);
});

test('PLANTED FAULTS: a pick not in a fixed list; a typed Value that is not its type; a route of another type into a picklist warns', () => {
  const sorted = (direction) => ({
    v: 2, id: 's', nodes: [
      { id: 's', kind: 'collection', x: 0, y: 0, values: { type: 'sort', direction } },
    ],
  });
  assert.deepEqual(workflowFaults(sorted('asc')), []);
  assert.deepEqual(workflowFaults(sorted('sideways')), ['the node "s" holds "sideways" as its Direction, which is none of its choices']);
  // The rows an object carries cannot be a field's name: the route joins (TODO 770), Field reads null and warns.
  const wrong = { ...flow(), routes: [...flow().routes, { from: 'start/rows', to: 'pick/field' }] };
  assert.deepEqual(workflowFaults(wrong), []);
  assert.deepEqual(workflowGraph(wrong).nodes.find((n) => n.id === 'pick').warnings, [{ row: 'field', words: 'Field takes a value; it was given rows' }]);
  // A Value node is typed: its text must be what its Type says.
  const typed = (type, value) => ({ v: 2, id: 't', nodes: [{ id: 'n', kind: 'value', x: 0, y: 0, values: { value, type } }] });
  assert.deepEqual(workflowFaults(typed('decimal', '12.5')), []);
  assert.deepEqual(workflowFaults(typed('decimal', 'twelve')), ['the node "n" holds "twelve" as its Value, which is not a number']);
  assert.deepEqual(workflowFaults(typed('integer', '12')), []);
  assert.deepEqual(workflowFaults(typed('integer', '12.5')), ['the node "n" holds "12.5" as its Value, which is not a whole number']);
  // A Number is no type now (TODO 777): the type is the fault.
  assert.deepEqual(workflowFaults(typed('number', 'twelve')), ['the node "n" holds "number" as its Type, which is none of its choices']);
  assert.deepEqual(workflowFaults(typed('list', ['a', 'b'])), []);
  assert.deepEqual(workflowFaults(typed('list', 'a, b')), ['the node "n" holds "a, b" as its Value, which is no list'], 'a List as text is no list now (TODO 777)');
  assert.deepEqual(workflowFaults(typed('boolean', 'maybe')), ['the node "n" holds "maybe" as its Value, which is not true or false']);
  assert.deepEqual(workflowFaults(typed('boolean', 'True')), []);
  assert.deepEqual(workflowFaults(typed('date', '2026-11-04')), []);
  assert.deepEqual(workflowFaults(typed('date', 'soon')), ['the node "n" holds "soon" as its Value, which is not a date']);
  assert.deepEqual(workflowFaults(typed('text', 'anything')), []);
  assert.deepEqual(workflowFaults({ ...typed('decimal', '1'), nodes: [{ id: 'n', kind: 'value', x: 0, y: 0, values: { type: 'object' } }] }), ['the node "n" holds "object" as its Type, which is none of its choices']);
});

test('a Value node is ADDED for a picklist row, holding its own pick, and routed in; a node is REMOVED with its routes', () => {
  const base = flow({ b: 'trial' });
  const made = addCustomValue(base, 'filter/b', { x: 120, y: 80 });
  const node = made.nodes.find((n) => n.id === 'value-1');
  assert.deepEqual([node.kind, node.x, node.y, node.values], ['value', 120, 80, { value: 'trial' }]);
  assert.deepEqual(made.routes.at(-1), { from: 'value-1/value', to: 'filter/b' });
  assert.deepEqual(workflowFaults(made), []);
  assert.equal(rowOf(made, 'filter', 'b').value, 'trial', 'it mirrors what it holds: the pick, as a custom value');
  assert.equal(rowOf(made, 'filter', 'b').custom, true);
  // A second one takes the next id; a row a route holds takes the new one in its place.
  const again = addCustomValue(made, 'filter/b', { x: 0, y: 0 });
  assert.deepEqual(again.nodes.filter((n) => n.kind === 'value').map((n) => n.id), ['status', 'value-1', 'value-2']);
  assert.deepEqual(again.routes.filter((r) => r.to === 'filter/b'), [{ from: 'value-2/value', to: 'filter/b' }]);
  // A row with no pick makes an empty node; a row that is no picklist, a header, or no row makes none.
  assert.deepEqual(addCustomValue(flow(), 'filter/rows', { x: 0, y: 0 }), flow());
  assert.deepEqual(addCustomValue(flow(), 'filter', { x: 0, y: 0 }), flow());
  assert.deepEqual(addCustomValue(flow(), 'nope/value', { x: 0, y: 0 }), flow());
  const bare = addCustomValue(flow(), 'pick/field', { x: 0, y: 0 });
  assert.equal(bare.nodes.find((n) => n.id === 'value-1').values?.value, 'status');
  // Remove: the node, and every route that touches it — by its header or by a row.
  const gone = editWorkflow(made, { remove: 'filter' });
  assert.deepEqual(gone.nodes.map((n) => n.id), ['start', 'status', 'end', 'pick', 'value-1']);
  assert.deepEqual(gone.routes, [{ from: 'start/rows', to: 'pick' }]);
  assert.deepEqual(workflowFaults(gone), []);
  assert.deepEqual(editWorkflow(made, { remove: 'nope' }).routes, made.routes);
  // Add: an id that is free; one that is not leaves the workflow alone.
  assert.equal(editWorkflow(base, { add: { id: 'x', kind: 'collection', x: 1, y: 2, values: { type: 'count' } } }).nodes.length, 6);
  assert.deepEqual(editWorkflow(base, { add: { id: 'end', kind: 'collection', x: 1, y: 2 } }), base);
  assert.deepEqual(base, flow({ b: 'trial' }), 'the one given is untouched');
});
