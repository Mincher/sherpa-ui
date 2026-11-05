/**
 * AN OLD KIND READS AS ITS FAMILY: the registry ships one node per family, its first row the type
 * (Value, Math, Time, Collection, Text, Tag), each type with its rows, sockets and hint. A Sort,
 * Group or Count saved before reads ONCE as a Collection of that type, and a Value's Number as a
 * Decimal: the same nodes, places, rows, values, routes and faults as the old registry drew. The
 * file is written anew only when it is saved again. Plan 749 P3; Will, D1, D7, D9.
 *
 *   node --test test/unit/an-old-kind-reads-as-its-family.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, ROWS, resolveKind, typeChoices } = await import(new URL('node-kinds.js', core));
const { editWorkflow, finalGraph, keptRoutes, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

/** The kinds as the registry had them before P3: three Collections, and a Value of four types. */
const field = { name: 'field', label: 'Field', control: 'field', input: 'value' };
const OLD = {
  ...Object.fromEntries(Object.entries(NODE_KINDS).filter(([id]) => !['math', 'time', 'collection', 'text', 'tag'].includes(id))),
  value: {
    heading: 'Value', icon: 'function', description: 'One value, typed.', branches: true, typeLabel: 'Type', defaultType: 'text',
    types: { text: { label: 'Text' }, number: { label: 'Number' }, date: { label: 'Date' }, boolean: { label: 'True/false' } },
    rows: [{ name: 'value', label: 'Value', control: 'text', output: 'value' }], model: 'typedValue', graphs: ['workflow'], category: 'Variables',
  },
  sort: {
    heading: 'Sort', icon: 'sort-ascending', description: 'The rows in order.', input: 'any', branches: true,
    rows: [ROWS, field, { name: 'direction', label: 'Direction', control: 'direction', input: 'value' }], model: 'sortRows', graphs: ['workflow'], category: 'Collections',
  },
  group: { heading: 'Group', icon: 'group', description: 'The rows by a field.', input: 'any', branches: true, rows: [ROWS, field], model: 'groupRows', graphs: ['workflow'], category: 'Collections' },
  count: { heading: 'Count', icon: 'insights', description: 'How many rows.', input: 'any', branches: true, rows: [{ name: 'count', label: 'Count', output: 'value' }], model: 'reduceRows', graphs: ['workflow'], category: 'Collections' },
};
const facts = { fields: { status: { label: 'Status' }, region: { label: 'Region' }, seats: { label: 'Seats', type: 'number' } }, values: { status: ['active', 'trial'] }, stores: ['customers'] };

const old = () => ({
  v: 2, id: 'old',
  nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'sort', kind: 'sort', x: 360, y: 0, values: { field: 'status', direction: 'desc' } },
    { id: 'group', kind: 'group', x: 720, y: 0, size: { w: 1.5, h: 1 }, values: { field: 'region' } },
    { id: 'count', kind: 'count', x: 1080, y: 200, heading: 'How many' },
    { id: 'seven', kind: 'value', x: 0, y: 300, values: { value: '7', type: 'number' } },
    { id: 'filter', kind: 'condition', x: 1080, y: 0, values: { field: 'seats', op: 'gt' } },
    { id: 'end', kind: 'output', x: 1440, y: 0 },
  ],
  routes: [
    { from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'group', via: [{ x: 640, y: 40 }] }, { from: 'group/rows', to: 'filter' },
    { from: 'group/rows', to: 'count' }, { from: 'seven/value', to: 'filter/value' }, { from: 'filter/rows', to: 'end' },
  ],
  ties: [{ id: 'tie-1', x: 1000, y: 20, routes: [{ from: 'group/rows', to: 'filter' }, { from: 'group/rows', to: 'count' }] }],
});
/** A drawing as a reader sees it, the family's own words aside: each node's place, sockets and rows after the type.
 *  What a row needs and gives is new with 764, and draws nothing. */
const seen = (g) => ({
  routes: g.routes, ties: g.ties,
  nodes: g.nodes.map(({ id, x, y, size, input, output, many, branches, category, rows }) => ({
    id, x, y, size, input, output, many, branches, category, rows: rows.filter((r) => r.name !== 'type').map(({ needs: _needs, gives: _gives, ...r }) => r),
  })),
});
const node = (g, id) => g.nodes.find((n) => n.id === id);

test('each family: its types in order, the Type row first, and the rows, sockets and hint of each type', () => {
  const rows = {
    value: { text: ['value'], integer: ['value'], decimal: ['value'], date: ['value'], boolean: ['value'], list: ['value'] },
    math: {
      add: ['a', 'b', 'result'], subtract: ['a', 'b', 'result'], multiply: ['a', 'b', 'result'], divide: ['a', 'b', 'result'], ratio: ['a', 'b', 'result'],
      round: ['places', 'a', 'result'], increment: ['a', 'b', 'result'], floor: ['values', 'result'], ceiling: ['values', 'result'], average: ['values', 'result'],
    },
    time: { between: ['start', 'end'], duration: ['when', 'n', 'unit'] },
    collection: { sort: ['rows', 'field', 'direction'], group: ['rows', 'field'], count: ['count'] },
    text: { append: ['a', 'b', 'result'], prepend: ['a', 'b', 'result'], split: ['a', 'separator', 'result'], join: ['values', 'separator', 'result'] },
    tag: { includes: ['rows', 'field', 'value'] },
  };
  for (const [id, types] of Object.entries(rows)) {
    assert.deepEqual(Object.keys(NODE_KINDS[id].types), Object.keys(types), id);
    for (const [type, names] of Object.entries(types)) {
      const kind = resolveKind(NODE_KINDS[id], type);
      // A family of one type, the Tag, draws no select.
      assert.deepEqual(kind.rows.map((r) => r.name), [...(id === 'tag' ? [] : ['type']), ...names], `${id} › ${type}`);
    }
  }
  assert.deepEqual(typeChoices(NODE_KINDS.math).map((c) => c.label), ['Add', 'Subtract', 'Multiply', 'Divide', 'Ratio', 'Round', 'Increment', 'Floor', 'Ceiling', 'Average']);
  assert.deepEqual(typeChoices(NODE_KINDS.collection).map((c) => c.label), ['Sort', 'Group by', 'Count']);
  assert.deepEqual(['value', 'math', 'time', 'collection', 'text'].map((k) => NODE_KINDS[k].typeLabel), ['Type', 'Operation', 'Operation', 'Type', 'Operation']);
  // Each Math, Time, Collection and Text type says what it does, under its select.
  for (const id of ['math', 'time', 'collection', 'text']) for (const [type, t] of Object.entries(NODE_KINDS[id].types)) assert.ok(t.help, `${id} › ${type} has a hint`);
  assert.equal(NODE_KINDS.math.types.add.help, 'Add Value B to Value A');
  // Sockets: Floor reads a LIST in, an object, and takes several (D9); a Result row gives a value; Split by gives a list.
  const floor = resolveKind(NODE_KINDS.math, 'floor').rows;
  assert.deepEqual(floor.map((r) => [r.name, r.input, r.output, r.many]), [['type', undefined, undefined, undefined], ['values', 'object', undefined, true], ['result', undefined, 'value', undefined]]);
  assert.equal(resolveKind(NODE_KINDS.text, 'split').rows.at(-1).output, 'object');
  assert.equal(resolveKind(NODE_KINDS.value, 'list').rows.at(-1).output, 'object');
  // Time takes the date on its header, of any type (D1), and forks: True, it holds; False, it does not.
  assert.deepEqual([NODE_KINDS.time.input, NODE_KINDS.time.branches], ['any', true]);
  assert.deepEqual(resolveKind(NODE_KINDS.time, 'duration').rows.slice(1).map((r) => r.control), ['span', 'number', 'unit']);
});

test('Math placed, then Round picked: its rows are redrawn, and Add\'s B waits in the draft', () => {
  let w = { v: 2, id: 'm', nodes: [{ id: 'math-1', kind: 'math', x: 0, y: 0, values: { a: 2.456, b: 1 } }] };
  assert.deepEqual(node(workflowGraph(w), 'math-1').rows.map((r) => r.name), ['type', 'a', 'b', 'result']);
  w = editWorkflow(w, { node: 'math-1', row: 'type', value: 'round' });
  w = editWorkflow(w, { node: 'math-1', row: 'places', value: '2' });
  const g = node(workflowGraph(w), 'math-1');
  assert.deepEqual(g.rows.map((r) => [r.name, r.label, r.value]), [['type', 'Operation', 'round'], ['places', 'Places', 2], ['a', 'Value', 2.456], ['result', 'Result', undefined]]);
  assert.equal(g.rows[0].hint, 'Rounds a decimal to a set number of places');
  assert.deepEqual(workflowFaults(w), []);
  assert.deepEqual(finalGraph(w).nodes[0].values, { a: 2.456, type: 'round', places: 2 }, 'Save leaves B behind');
});

test('an old file reads ONCE with the same drawing and the same faults: Sort, Group and Count are a Collection; a Number, a Decimal', () => {
  const given = old();
  const read = readWorkflow(given).workflow;
  assert.deepEqual(read.nodes.map((n) => [n.id, n.kind, n.values?.type]), [
    ['start', 'store', undefined], ['sort', 'collection', 'sort'], ['group', 'collection', 'group'], ['count', 'collection', 'count'],
    ['seven', 'value', 'decimal'], ['filter', 'condition', undefined], ['end', 'output', undefined],
  ]);
  // The rest of each node is as it was: its values, its place, its size, its own name.
  assert.deepEqual(read.nodes[1].values, { field: 'status', direction: 'desc', type: 'sort' });
  assert.deepEqual([read.nodes[2].size, read.nodes[3].heading], [{ w: 1.5, h: 1 }, 'How many']);
  assert.deepEqual([read.routes, read.ties], [given.routes, given.ties]);
  assert.deepEqual(given, old(), 'the one given is untouched');
  // The same drawing as the old registry gave it, and the same (no) faults.
  const before = workflowGraph(given, facts, OLD);
  const after = workflowGraph(given, facts);
  assert.deepEqual(seen(after), seen(before));
  assert.deepEqual(workflowFaults(given, NODE_KINDS, facts), workflowFaults(given, OLD, facts));
  assert.deepEqual(workflowFaults(given, NODE_KINDS, facts), []);
  // Only the family's words are new: its heading, and the Type row first, naming the old kind.
  assert.deepEqual(['sort', 'group', 'count'].map((id) => [node(after, id).heading, node(after, id).rows[0].value]), [['Collection', 'sort'], ['Collection', 'group'], ['How many', 'count']]);
  assert.deepEqual(node(after, 'seven').rows[0].value, 'decimal');
  // An edit reads it first, so a save writes the new form; read again, it is as it is.
  const saved = finalGraph(editWorkflow(given, { node: 'start', set: { x: 10 } }));
  assert.deepEqual(saved.nodes.slice(1), read.nodes.slice(1));
  assert.equal(readWorkflow(saved).workflow, saved);
});

test('an old file with faults has the same faults; a v1 reads the same as before', () => {
  const faulty = old();
  faulty.nodes[1] = { ...faulty.nodes[1], values: { field: 'status', direction: 'sideways' } };
  faulty.routes = [...faulty.routes, { from: 'start/rows', to: 'sort/field' }];
  faulty.nodes[4] = { ...faulty.nodes[4], values: { value: 'seven', type: 'number' } };
  // The faults the old registry's checks gave, word for word: a Decimal says "a number", as a Number did. The rows into
  // a Field are no fault: they join (TODO 770), and the Field reads null and warns, under either registry.
  const want = [
    'the node "sort" holds "sideways" as its Direction, which is none of its choices',
    'the node "seven" holds "seven" as its Value, which is not a number',
  ];
  for (const kinds of [NODE_KINDS, OLD]) assert.deepEqual(node(workflowGraph(faulty, facts, kinds), 'sort').warnings, [{ row: 'field', words: 'Field takes a value; it was given rows' }]);
  assert.deepEqual(workflowFaults(faulty, NODE_KINDS, facts), want);
  assert.deepEqual(workflowFaults(faulty, OLD, facts).filter((f) => !f.includes('"seven"')), want.filter((f) => !f.includes('"seven"')));
  // The same drawing, but that a Decimal's row says its fault in words, as the old Number had no type to check (P4).
  const drawn = seen(workflowGraph(faulty, facts));
  assert.equal(node(drawn, 'seven').rows[0].fault, '"seven" is not a number');
  delete node(drawn, 'seven').rows[0].fault;
  assert.deepEqual(drawn, seen(workflowGraph(faulty, facts, OLD)));
  // A v1: a Sort's header routes leave its Rows row; a Count has none, so its route goes, with the same fault.
  const v1 = {
    v: 1, id: 'one',
    nodes: [{ id: 'start', kind: 'store', x: 0, y: 0 }, { id: 's', kind: 'sort', x: 300, y: 0 }, { id: 'c', kind: 'count', x: 600, y: 0 }, { id: 'end', kind: 'output', x: 900, y: 0 }],
    routes: [{ from: 'start', to: 's' }, { from: 's', to: 'c' }, { from: 'c', to: 'end' }],
  };
  const [was, now] = [readWorkflow(v1, OLD), readWorkflow(v1)];
  assert.deepEqual(now.faults, was.faults);
  assert.deepEqual(now.workflow.routes, was.workflow.routes);
  assert.deepEqual(now.faults, ['the v1 route "c" → "end" sends rows from the header of "c", whose kind has no Rows row to send them from in v2']);
  assert.deepEqual(workflowFaults(v1), workflowFaults(v1, OLD));
});

test('an app\'s own kind of an old name is its own; a Number its own Value keeps is kept', () => {
  const mine = { ...OLD.sort, heading: 'My sort' };
  const w = { v: 2, id: 'w', nodes: [{ id: 's', kind: 'sort', x: 0, y: 0 }, { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'number', value: '1' } }] };
  const read = readWorkflow(w, { ...NODE_KINDS, sort: mine, value: OLD.value }).workflow;
  assert.equal(read, w, 'nothing to read: the kinds hold both');
});

test('PLANTED FAULTS: a route into a row no Math type has; a Duration of no span; a List into a single-value row warns', () => {
  const flow = (math, routes, more = []) => ({
    v: 2, id: 'p',
    nodes: [
      { id: 'list', kind: 'value', x: 0, y: 0, values: { type: 'list', value: '1, 2, 3' } },
      { id: 'one', kind: 'value', x: 0, y: 200, values: { type: 'integer', value: '4' } },
      { id: 'm', kind: 'math', x: 300, y: 0, values: math }, ...more,
    ],
    routes,
  });
  // A route into a row no type has: no input socket. Into a row only another type has: kept, not a fault, and not saved.
  assert.deepEqual(workflowFaults(flow({ type: 'add' }, [{ from: 'one/value', to: 'm/c' }])), ['a route enters "m/c", which is no input socket']);
  const other = flow({ type: 'floor' }, [{ from: 'one/value', to: 'm/a' }]);
  assert.deepEqual([workflowFaults(other), keptRoutes(other).length, workflowGraph(other).routes, finalGraph(other).routes], [[], 1, [], []]);
  // A List is an object: into Add's A it joins and warns (TODO 770); into Floor's Values it is read, several of them too (D4, D9).
  const warned = (w) => [workflowFaults(w), workflowGraph(w).nodes.find((n) => n.id !== 'list' && n.warnings)?.warnings.map((x) => x.words)];
  assert.deepEqual(warned(flow({ type: 'add' }, [{ from: 'list/value', to: 'm/a' }])), [[], ['Value A takes a number; it was given a list']]);
  const lists = flow({ type: 'average' }, [{ from: 'list/value', to: 'm/values' }, { from: 'list2/value', to: 'm/values' }], [{ id: 'list2', kind: 'value', x: 0, y: 400, values: { type: 'list' } }]);
  assert.deepEqual(workflowFaults(lists), []);
  assert.deepEqual(warned(flow({ type: 'floor' }, [{ from: 'one/value', to: 'm/values' }])), [[], ['Values takes a list of numbers; it was given "4"']]);
  // Picking Text for the List: its row sends a value, so the route stays and warns, until it is cut or List picked again.
  const retyped = editWorkflow(flow({ type: 'floor' }, [{ from: 'list/value', to: 'm/values' }]), { node: 'list', row: 'type', value: 'text' });
  assert.deepEqual(warned(retyped), [[], ['Values takes a list of numbers; it was given "1, 2, 3"']]);
  // A number row holds a number; a span or a unit is one of its list.
  assert.deepEqual(workflowFaults(flow({ type: 'round', places: 'two' }, [])), ['the node "m" holds "two" as its Places, which is no number']);
  const time = (values) => ({ v: 2, id: 't', nodes: [{ id: 't', kind: 'time', x: 0, y: 0, values: { type: 'duration', ...values } }] });
  assert.deepEqual(workflowFaults(time({ when: 'last', n: 7, unit: 'day' })), []);
  assert.deepEqual(workflowFaults(time({ when: 'ago', unit: 'fortnight' })), [
    'the node "t" holds "ago" as its When, which is none of its choices',
    'the node "t" holds "fortnight" as its Unit, which is none of its choices',
  ]);
  // Split by gives a list: a Text's Value A cannot use it, and warns.
  const split = { v: 2, id: 's', nodes: [{ id: 'cut', kind: 'text', x: 0, y: 0, values: { type: 'split' } }, { id: 'add', kind: 'text', x: 300, y: 0 }], routes: [{ from: 'cut/result', to: 'add/a' }] };
  assert.deepEqual(warned(split), [[], ['Value A takes a value; it was given a list']]);
  assert.deepEqual(workflowFaults({ ...split, nodes: [split.nodes[0], { ...split.nodes[1], values: { type: 'join' } }], routes: [{ from: 'cut/result', to: 'add/values' }] }), []);
});
