/**
 * A FAMILY DRAWS ITS TYPES: the registry ships one node per family, its first row the type (Value, Math,
 * Time, Collection, Text, Tag), each type with its rows, sockets and hint; a row another type has waits in
 * the draft; a row no type has is no socket. No kind or type saved before is read as today's (Will, TODO
 * 777: the old-kind, Number and tags-as-text reads are gone). Plan 749 P3; Will, D1, D7, D9.
 *
 *   node --test test/unit/a-family-draws-its-types.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, resolveKind, typeChoices } = await import(new URL('node-kinds.js', core));
const { editWorkflow, finalGraph, keptConnections, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const facts = { fields: { status: { label: 'Status' }, region: { label: 'Region' }, seats: { label: 'Seats', type: 'number' } }, values: { status: ['active', 'trial'] }, stores: ['customers'] };

const node = (g, id) => g.nodes.find((n) => n.id === id);

test('each family: its types in order, the Type row first, and the rows, sockets and hint of each type', () => {
  const rows = {
    value: { text: ['value'], integer: ['value'], decimal: ['value'], date: ['value'], boolean: ['value'], list: ['value'] },
    math: {
      add: ['a', 'b', 'result'], subtract: ['a', 'b', 'result'], multiply: ['a', 'b', 'result'], divide: ['a', 'b', 'result'], ratio: ['a', 'b', 'result'],
      round: ['places', 'a', 'result'], increment: ['a', 'b', 'result'], min: ['values', 'result'], max: ['values', 'result'], average: ['values', 'result'],
      // The list's statistics (plan 991a); Count, how many rows come in (plan 944), beside Count unique; then Band.
      sum: ['values', 'result'], median: ['values', 'result'], range: ['values', 'result'],
      count: ['rows', 'result'], unique: ['values', 'result'],
      band: ['a', 'bands', 'labels', 'result'],
    },
    // A test leads with Pass and Fail (plan 971).
    time: { between: ['pass', 'fail', 'start', 'end'], duration: ['pass', 'fail', 'when', 'n', 'unit'] },
    text: { append: ['a', 'b', 'result'], prepend: ['a', 'b', 'result'], split: ['a', 'separator', 'result'], join: ['values', 'separator', 'result'], format: ['rows', 'template', 'result'] },
    tag: { includes: ['pass', 'fail', 'value'] },
  };
  for (const [id, types] of Object.entries(rows)) {
    assert.deepEqual(Object.keys(NODE_KINDS[id].types), Object.keys(types), id);
    for (const [type, names] of Object.entries(types)) {
      const kind = resolveKind(NODE_KINDS[id], type);
      // A family of one type, the Tag, draws no select.
      assert.deepEqual(kind.rows.map((r) => r.name), [...(id === 'tag' ? [] : ['type']), ...names], `${id} › ${type}`);
    }
  }
  assert.deepEqual(typeChoices(NODE_KINDS.math).map((c) => c.label), ['Add', 'Subtract', 'Multiply', 'Divide', 'Ratio', 'Round', 'Increment', 'Min', 'Max', 'Average', 'Sum', 'Median', 'Range', 'Count', 'Count unique', 'Band']);
  // Organise is one kind, no types (plan 960 U4.2): rows on its header, its fields in its own rows; no Count row (plan 944).
  const organise = NODE_KINDS.organise;
  assert.deepEqual([organise.types, organise.category, organise.input, organise.needs, organise.rows.map((r) => r.name)],
    [undefined, 'Organise', 'any', 'rows', ['rows', 'sort', 'direction', 'group', 'search', 'primary', 'secondary', 'segments']]);
  assert.deepEqual(['value', 'math', 'time', 'text'].map((k) => NODE_KINDS[k].typeLabel), ['Type', 'Operation', 'Check', 'Operation']);
  // Each Math, Time and Text type says what it does, under its select.
  for (const id of ['math', 'time', 'text']) for (const [type, t] of Object.entries(NODE_KINDS[id].types)) assert.ok(t.help, `${id} › ${type} has a hint`);
  assert.equal(NODE_KINDS.math.types.add.help, 'Add Value B to Value A');
  // Sockets: Min reads a LIST in, an object, and takes several (D9); a Result row gives a value; Split by gives a list.
  const floor = resolveKind(NODE_KINDS.math, 'min').rows;
  assert.deepEqual(floor.map((r) => [r.name, r.input, r.output, r.many]), [['type', undefined, undefined, undefined], ['values', 'object', undefined, true], ['result', undefined, 'value', undefined]]);
  assert.equal(resolveKind(NODE_KINDS.text, 'split').rows.at(-1).output, 'object');
  assert.equal(resolveKind(NODE_KINDS.value, 'list').rows.at(-1).output, 'object');
  // Count reads rows on its Rows row, one connection, and gives a number (plan 944).
  assert.deepEqual(resolveKind(NODE_KINDS.math, 'count').rows.slice(1).map((r) => [r.name, r.input, r.needs, r.output, r.gives, r.many]), [['rows', 'object', 'rows', undefined, undefined, undefined], ['result', undefined, undefined, 'value', 'number', undefined]]);
  // Time takes the date on its header, of any type (D1), and sends a boolean: True, it holds (no False now, TODO 831).
  assert.deepEqual([NODE_KINDS.time.input, NODE_KINDS.time.output], ['any', 'boolean']);
  assert.deepEqual(resolveKind(NODE_KINDS.time, 'duration').rows.slice(3).map((r) => r.control), ['span', 'number', 'unit']);
});

test('Math placed, then Round picked: its rows are redrawn, and Add\'s B waits in the draft', () => {
  let w = { v: 3, id: 'm', nodes: [{ id: 'math-1', kind: 'math', x: 0, y: 0, values: { a: 2.456, b: 1 } }] };
  assert.deepEqual(node(workflowGraph(w), 'math-1').rows.map((r) => r.name), ['type', 'a', 'b', 'result']);
  w = editWorkflow(w, { node: 'math-1', row: 'type', value: 'round' });
  w = editWorkflow(w, { node: 'math-1', row: 'places', value: '2' });
  const g = node(workflowGraph(w), 'math-1');
  assert.deepEqual(g.rows.map((r) => [r.name, r.label, r.value]), [['type', 'Operation', 'round'], ['places', 'Places', 2], ['a', 'Value', 2.456], ['result', 'Result', undefined]]);
  assert.equal(g.rows[0].hint, 'Rounds a decimal to a set number of places');
  assert.deepEqual(workflowFaults(w), []);
  assert.deepEqual(finalGraph(w).nodes[0].values, { a: 2.456, type: 'round', places: 2 }, 'Save leaves B behind');
});

test('PLANTED FAULTS: a connection into a row no Math type has; a Duration of no span; a List into a single-value row warns', () => {
  const flow = (math, connections, more = []) => ({
    v: 3, id: 'p',
    nodes: [
      { id: 'list', kind: 'value', x: 0, y: 0, values: { type: 'list', value: ['1', '2', '3'] } },
      { id: 'one', kind: 'value', x: 0, y: 200, values: { type: 'integer', value: 4 } },
      { id: 'm', kind: 'math', x: 300, y: 0, values: math }, ...more,
    ],
    connections,
  });
  // A connection into a row no type has: no input socket. Into a row only another type has: kept, not a fault, and not saved.
  assert.deepEqual(workflowFaults(flow({ type: 'add' }, [{ from: 'one/value', to: 'm/c' }])), ['a connection enters "m/c", which is no input socket']);
  const other = flow({ type: 'min' }, [{ from: 'one/value', to: 'm/a' }]);
  assert.deepEqual([workflowFaults(other), keptConnections(other).length, workflowGraph(other).connections, finalGraph(other).connections], [[], 1, [], []]);
  // A List is an object: into Add's A it joins and warns (TODO 770); into Min's Values it is read, several of them too (D4, D9).
  const warned = (w) => [workflowFaults(w), workflowGraph(w).nodes.find((n) => n.id !== 'list' && n.warnings)?.warnings.map((x) => x.words)];
  assert.deepEqual(warned(flow({ type: 'add' }, [{ from: 'list/value', to: 'm/a' }])), [[], ['Value A takes a number; it was given a list']]);
  const lists = flow({ type: 'average' }, [{ from: 'list/value', to: 'm/values' }, { from: 'list2/value', to: 'm/values' }], [{ id: 'list2', kind: 'value', x: 0, y: 400, values: { type: 'list' } }]);
  assert.deepEqual(workflowFaults(lists), []);
  assert.deepEqual(warned(flow({ type: 'min' }, [{ from: 'one/value', to: 'm/values' }])), [[], ['Values takes a list of numbers; it was given "4"']]);
  // Picking Text for the List: its row sends a value, so the connection stays and warns, until it is cut or List picked again.
  const retyped = editWorkflow(flow({ type: 'min' }, [{ from: 'list/value', to: 'm/values' }]), { node: 'list', row: 'type', value: 'text' });
  assert.deepEqual(warned(retyped), [[], ['Values takes a list of numbers; it was given "1, 2, 3"']]);
  // A number row holds a number; a span or a unit is one of its list.
  assert.deepEqual(workflowFaults(flow({ type: 'round', places: 'two' }, [])), ['the node "m" holds "two" as its Places, which is no number']);
  const time = (values) => ({ v: 3, id: 't', nodes: [{ id: 't', kind: 'time', x: 0, y: 0, values: { type: 'duration', ...values } }] });
  assert.deepEqual(workflowFaults(time({ when: 'last', n: 7, unit: 'day' })), []);
  assert.deepEqual(workflowFaults(time({ when: 'ago', unit: 'fortnight' })), [
    'the node "t" holds "ago" as its When, which is none of its choices',
    'the node "t" holds "fortnight" as its Unit, which is none of its choices',
  ]);
  // Split by gives a list: a Text's Value A cannot use it, and warns.
  const split = { v: 3, id: 's', nodes: [{ id: 'cut', kind: 'text', x: 0, y: 0, values: { type: 'split' } }, { id: 'add', kind: 'text', x: 300, y: 0 }], connections: [{ from: 'cut/result', to: 'add/a' }] };
  assert.deepEqual(warned(split), [[], ['Value A takes a value; it was given a list']]);
  assert.deepEqual(workflowFaults({ ...split, nodes: [split.nodes[0], { ...split.nodes[1], values: { type: 'join' } }], connections: [{ from: 'cut/result', to: 'add/values' }] }), []);
});
