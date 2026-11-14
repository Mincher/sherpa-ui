/**
 * A SOCKET SAYS ITS TYPE: a value, an object, a boolean, or — an input only — any.
 * One function, accepts(), says which output an input reads as its own; the registry says
 * each socket's type and whether an input takes many connections. No node has a True or a
 * False socket, and a Condition has no True row: a test branches by its Pass and Fail rows
 * (plans 944, 971 §9). Any connection joins any input (TODO 770): one of another type reads null,
 * and its node warns; workflowFaults refuses only a socket that is not there. One
 * rowChoices() says every list a picklist row reads. A node's data comes in on its header,
 * of any type, and leaves its Rows row, or a test's Pass and Fail. Will, TODO 713 (D1, D2, D4, D17) · plan 713 M1, M3.
 * TRAP T-a-socket-says-its-type
 *
 *   node --test test/unit/a-socket-says-its-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, FALSE_SOCKET, ROWS, TEST_KINDS, accepts, kindNode, resolveKind, rowChoices, socketType, takesMany, truthy } = await import(new URL('node-kinds.js', core));
const { editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const TYPES = ['value', 'object', 'boolean'];

test('each type joins only its own; any takes all, and no output sends any', () => {
  for (const from of TYPES) {
    for (const to of TYPES) assert.equal(accepts(from, to), from === to, `${from} → ${to}`);
    assert.equal(accepts(from, 'any'), true, `${from} → any`);
    assert.equal(accepts('any', from), false, `any → ${from}`);
  }
  assert.equal(accepts('any', 'any'), false);
});

test('True and False are truthiness (D2): nothing is False, anything else True', () => {
  for (const nothing of [undefined, null, false, 0, -0, NaN, 0n, '', '  ', [], {}, Object.create(null), new Set(), new Map()]) {
    assert.equal(truthy(nothing), false, inspect(nothing));
  }
  // A typed value, not a word: the text "false" is text, and something.
  for (const something of [true, 1, -1, Infinity, 'a', 'false', [0], [null], { a: 0 }, new Set([0]), new Date(0)]) {
    assert.equal(truthy(something), true, inspect(something));
  }
});

// An app's kinds beside the library's, one for each new part of a socket.
const kinds = {
  ...NODE_KINDS,
  // An app's fork: any comes in (D1); a boolean leaves each of its Yes and No rows, as no header does (plan 944).
  fork: {
    heading: 'Fork', icon: 'function', input: 'any', model: 'fork', graphs: ['workflow'],
    rows: [{ name: 'rows', label: 'Rows', input: 'object', output: 'object' }, { name: 'yes', label: 'Yes', output: 'boolean' }, { name: 'no', label: 'No', output: 'boolean' }],
  },
  // Booleans in, many; a multi-select row: one object in, one out (D17).
  gate: {
    heading: 'Gate', icon: 'flag', input: 'boolean', many: true, model: 'gate', graphs: ['workflow'],
    rows: [{ name: 'tags', label: 'Tags', control: 'field', multiple: true, input: 'object', output: 'object' }, { name: 'note', label: 'Note', input: 'value' }],
  },
  log: { heading: 'Log', icon: 'flag', input: 'any', many: true, rows: [], model: 'log', graphs: ['workflow'] },
  odd: { heading: 'Odd', icon: 'flag', output: 'any', rows: [], model: 'odd', graphs: ['workflow'] },
};

test('the registry says each socket: a row\'s and the header\'s; no node has a True or a False socket (plan 944)', () => {
  assert.equal(FALSE_SOCKET, undefined, 'no False socket (plan 944)');
  assert.equal(socketType(kinds.fork, undefined, 'input'), 'any');
  assert.equal(socketType(kinds.fork, undefined, 'output'), undefined, 'its header sends nothing');
  assert.equal(socketType(kinds.fork, 'yes', 'output'), 'boolean');
  assert.equal(socketType(kinds.fork, 'no', 'input'), undefined, 'No is an output only');
  assert.equal(socketType(kinds.fork, 'rows', 'input'), 'object');
  // A kind that still says `branches` forks no more (plan 944).
  assert.deepEqual(['#false', undefined].map((row) => socketType({ ...kinds.fork, branches: true }, row, 'output')), [undefined, undefined]);
  assert.equal(socketType(NODE_KINDS.result, '#false', 'output'), undefined, 'no False');
  assert.equal(socketType(NODE_KINDS.result, undefined, 'output'), undefined, 'the end sends nothing');
  // A Condition's header sends nothing, and it has no True row (plan 971 §9).
  assert.equal(socketType(NODE_KINDS.condition, undefined, 'output'), undefined, 'a Condition\'s header sends nothing');
  assert.equal(socketType(resolveKind(NODE_KINDS.condition), 'true', 'output'), undefined, 'a Condition has no True');
  // A test of one value: its value on its header, its Data on a row, and its Pass and Fail rows (plan 971 §9).
  assert.deepEqual([[undefined, 'input'], ['data', 'input'], ['pass', 'output'], ['fail', 'output'], [undefined, 'output']].map(([row, side]) => socketType(resolveKind(NODE_KINDS.condition), row, side)), ['any', 'any', 'object', 'object', undefined]);
  assert.equal(takesMany(kinds.gate), true);
  assert.equal(takesMany(kinds.gate, 'tags'), false);
  assert.equal(takesMany(NODE_KINDS.result), false);
  // A drawn node carries its many, for the tip to read; no fork (plan 944).
  const drawn = kindNode(kinds, 'gate', 'g', []);
  assert.deepEqual([drawn.many, kindNode({ ...kinds, old: { ...kinds.fork, branches: true } }, 'old', 'f', []).branches], [true, undefined]);
  // A drawn node says its sockets as its kind does.
  assert.equal(socketType(kindNode(NODE_KINDS, 'condition', 'x', resolveKind(NODE_KINDS.condition).rows), 'pass', 'output'), 'object');
});

test('the rows come in on the header, of ANY type (D1), and leave a Rows row, or a test\'s Pass and Fail, that only sends; only a test branches (plan 971 §9)', () => {
  assert.deepEqual(ROWS, { name: 'rows', label: 'Results', output: 'object', gives: 'rows', property: true });
  const all = Object.entries(NODE_KINDS);
  // A header input takes any; no header sends rows: a Rows row does, first.
  for (const [name, kind] of all) {
    assert.ok([undefined, 'any'].includes(kind.input), `${name}: its header takes any`);
    assert.ok([undefined, 'boolean'].includes(kind.output) || kind.passes, `${name}: no header sends rows, but one that passes on what reaches it`);
    const at = kind.rows.findIndex((r) => r.name === ROWS.name);
    // A Source's Rows leave from its Store row: drawn beside it, not a line of its own (TODO 830).
    if (at >= 0) assert.deepEqual([at, kind.rows[at]], [0, name === 'source' ? { ...ROWS, beside: 'store' } : ROWS], `${name}: its Rows row, first`);
  }
  const named = (test) => all.filter(([, k]) => test(k)).map(([n]) => n);
  assert.deepEqual(named((k) => k.rows.some((r) => r.name === ROWS.name)), ['source', 'organise']);
  // A family's types say their own rows: every type of a test sends its rows from Pass and Fail, first (plan 971); none from Results.
  const typed = all.flatMap(([n, k]) => Object.entries(k.types ?? {}).map(([t, type]) => [`${n} › ${t}`, type.rows ?? []]));
  assert.deepEqual(typed.filter(([, rows]) => rows.includes(ROWS)), []);
  const split = typed.filter(([, rows]) => rows.some((r) => r.name === 'pass'));
  for (const [name, rows] of split) assert.deepEqual(rows.slice(0, 2).map((r) => [r.name, r.gives]), [['pass', 'rows'], ['fail', 'rows']], `${name}: Pass and Fail, first`);
  assert.deepEqual(split.map(([name]) => name), [
    ...Object.keys(NODE_KINDS.condition.types).map((t) => `condition › ${t}`), 'time › between', 'time › duration',
  ]);
  assert.deepEqual([...new Set(split.map(([name]) => name.split(' › ')[0]))], [...TEST_KINDS]);
  // No kind forks (plan 944): only a test branches, by Pass and Fail rows that, on one value, pass on its Data. A check that sends
  // a boolean on its header says `output`: a Trigger (its True, to the Start: plan 949), a Preset (a scope's row), a Time
  // and a Tag.
  assert.deepEqual(named((k) => k.branches), []);
  assert.deepEqual(named((k) => [k, ...Object.values(k.types ?? {})].some((t) => (t.rows ?? []).some((r) => r.passes))), [...TEST_KINDS]);
  assert.deepEqual(named((k) => k.output === 'boolean'), ['trigger', 'preset', 'time']);
  // No type forks, and a header sends rows from no type: a portal's Out sends from its rows (TODO 826).
  // Only Logic's header takes by its type, rows, booleans, none; and a portal's, an In anything, many.
  for (const [name, kind] of all) for (const [id, type] of Object.entries(kind.types ?? {})) assert.deepEqual([type.branches, type.output], [undefined, undefined], `${name} › ${id}`);
  // A True row: an AI node that expects True/false (plan 944); no Condition type (plan 971 §9).
  assert.deepEqual(typed.filter(([, rows]) => rows.some((r) => r.name === 'true')).map(([name]) => name), ['prompt › boolean', 'runbook › boolean', 'skill › boolean']);
  assert.deepEqual(all.filter(([, k]) => Object.values(k.types ?? {}).some((t) => t.input)).map(([n]) => n), ['condition', 'portal']);
  // A comparison tests what comes in on its header (plan 783 D3): a Field's column, or a value.
  // And and Or take anything, several (TODO 939); Not one boolean.
  assert.deepEqual(['and', 'not', 'empty', 'eq'].map((t) => [NODE_KINDS.condition.types[t].input, NODE_KINDS.condition.types[t].many]), [['any', true], ['boolean', undefined], ['any', undefined], ['any', undefined]]);
  assert.equal(NODE_KINDS.condition.types.rows, undefined, 'Rows that hold is gone (plan 783 D4)');
  // Every kind a workflow runs, the Trigger (plan 941), the Branch, the end and a portal, which passes on what reaches it (TODO 779), among them.
  assert.deepEqual(named((k) => k.graphs.includes('workflow')), ['trigger', 'source', 'condition', 'route', 'boolean', 'organise', 'value', 'field', 'math', 'time', 'text', 'portal', 'model', 'prompt', 'runbook', 'skill', 'notify', 'content', 'response', 'result', 'request', 'output-trigger']);
});

test('every shipped kind says its types once: no output sends any; none forks; a multi-select row is an object, one connection in', () => {
  for (const [name, kind] of Object.entries(NODE_KINDS)) {
    assert.notEqual(kind.output, 'any', name);
    assert.equal(kind.branches, undefined, `${name}: no kind forks (plan 944)`);
    // A header sends a boolean, nothing, or, passing on what reaches it, that: the Boolean (plan 971 §9).
    if (kind.output) assert.ok(kind.output === 'boolean' || (kind.passes && kind.output === 'object'), `${name}: a header sends a boolean, nothing, or what it passes on`);
    for (const row of kind.rows) {
      assert.notEqual(row.output, 'any', `${name}/${row.name}`);
      if (!row.multiple) continue;
      assert.ok([undefined, 'object'].includes(row.input) && [undefined, 'object'].includes(row.output), `${name}/${row.name}: a set is an object`);
      assert.equal(row.many, undefined, `${name}/${row.name}: one set comes in`);
    }
  }
});

// Sound: rows into the fork; its Yes and its No into a gate that takes many; a Math Count's number into a Log (plan 944).
const node = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const sound = {
  v: 3, id: 'typed',
  nodes: [node('start', 'source'), node('v', 'value'), node('f', 'fork'), node('g', 'gate'), node('l', 'log'), node('c', 'math', { type: 'count' }), node('end', 'result')],
  connections: [
    { from: 'start/rows', to: 'f/rows' }, { from: 'f/yes', to: 'g' }, { from: 'f/no', to: 'g' },
    { from: 'f/rows', to: 'end' }, { from: 'v/value', to: 'l' }, { from: 'c/result', to: 'l' }, { from: 'start/rows', to: 'c/rows' },
  ],
};
const planted = (change) => workflowFaults({ ...structuredClone(sound), ...change }, kinds);

test('a sound typed workflow has no fault, and its schema takes it', () => {
  assert.deepEqual(workflowFaults(sound, kinds), []);
  assert.deepEqual(schemaCheck('workflow.v3.json')(sound), []);
  const socket = schemaCheck('defs.v1.json#/$defs/socket');
  // An AI node's True and a fork's Yes are rows (plan 944).
  assert.deepEqual([socket('c/true'), socket('k/yes')], [[], []]);
  assert.notDeepEqual(socket('f/#true'), [], 'a # part is no row');
  assert.notDeepEqual(socket('f/#false/more'), []);
});

test('a connection of another type joins, no fault: the input reads null, and its node warns in words (TODO 770)', () => {
  const nodes = [...sound.nodes, node('x', 'value', { value: 'x' })];
  const cases = [
    [{ from: 'f/yes', to: 'g/tags' }, 'Tags takes a list; it was given a boolean'],
    [{ from: 'start/rows', to: 'g/note' }, 'Note takes a value; it was given rows'],
    // A typed header needs its type: a Gate's, a boolean.
    [{ from: 'x/value', to: 'g' }, 'Gate takes a boolean; it was given "x"'],
    // A multi-select row takes one set: an object, never a value (D17).
    [{ from: 'x/value', to: 'g/tags' }, 'Tags takes a list; it was given "x"'],
  ];
  for (const [connection, words] of cases) {
    const w = { ...structuredClone(sound), nodes, connections: [...sound.connections, connection] };
    assert.deepEqual(workflowFaults(w, kinds), [], `${connection.from} → ${connection.to} is no fault`);
    assert.deepEqual(workflowGraph(w, {}, kinds).nodes.find((n) => n.id === 'g').warnings?.map((x) => x.words), [words]);
  }
  // A boolean into a value row reads as the word, true or false: COERCIONS, no warning (TODO 781).
  const word = { ...structuredClone(sound), nodes, connections: [...sound.connections, { from: 'f/yes', to: 'g/note' }] };
  assert.deepEqual([workflowFaults(word, kinds), workflowGraph(word, {}, kinds).nodes.find((n) => n.id === 'g').warnings], [[], undefined]);
});

test('a socket that is not there is refused, in words; so is an output that says it sends any type', () => {
  const nodes = [...sound.nodes, node('t', 'condition')];
  const cases = [
    [[{ from: 'end/#false', to: 'g' }], 'a connection leaves "end/#false", which is no output socket'],
    [[{ from: 'f/yes', to: 'g/#false' }], 'a connection enters "g/#false", which is no input socket'],
    // A Condition's header, its old False and its old True send nothing (plans 944, 971 §9): its Pass is a row.
    [[{ from: 't', to: 'g' }], 'a connection leaves "t", which is no output socket'],
    [[{ from: 't/#false', to: 'g' }], 'a connection leaves "t/#false", which is no output socket'],
    [[{ from: 't/true', to: 'g' }], 'a connection leaves "t/true", which is no output socket'],
  ];
  for (const [connections, said] of cases) assert.ok(planted({ nodes, connections: [...sound.connections, ...connections] }).includes(said), `${said} — heard: ${planted({ nodes, connections: [...sound.connections, ...connections] }).join(' | ')}`);
  assert.deepEqual(planted({ nodes, connections: [...sound.connections, { from: 't/pass', to: 'l' }] }), [], 'its Pass row sends');
  const odd = planted({ nodes: [...nodes, node('o', 'odd')], connections: [...sound.connections, { from: 'o', to: 'l' }] });
  assert.ok(odd.includes('a connection leaves "o", which sends any type: an output says the one it sends'), odd.join(' | '));
});

test('a second connection into an input that is not `many` is a fault; into a `many` one it is not, unless it is the same connection; any type joins an any', () => {
  assert.ok(planted({ connections: [...sound.connections, { from: 'start/rows', to: 'g/tags' }, { from: 'f/rows', to: 'g/tags' }] }).includes('two connections enter "g/tags", which takes one'));
  assert.ok(planted({ connections: [...sound.connections, { from: 'f/yes', to: 'g' }] }).includes('the connection "f/yes" → "g" is there twice'));
  // An any input that takes many: values from two nodes join, and an object beside them too (TODO 770).
  assert.deepEqual(planted({ connections: sound.connections.filter((r) => r.to !== 'l').concat({ from: 'v/value', to: 'l' }, { from: 'c/result', to: 'l' }) }), []);
  const mixed = { ...structuredClone(sound), connections: [...sound.connections, { from: 'start/rows', to: 'l' }] };
  assert.deepEqual([workflowFaults(mixed, kinds), workflowGraph(mixed, {}, kinds).nodes.find((n) => n.id === 'l').warnings], [[], undefined]);
  // A multi-select row holds a list.
  assert.ok(planted({ nodes: [...sound.nodes.filter((n) => n.id !== 'g'), node('g', 'gate', { tags: 'status' })] }).includes('the node "g" holds "status" as its Tags, which is no list'));
});

test('an edit keeps every connection into a `many` input, replaces the one into any other, and cuts one connection or all', () => {
  const into = (w, to) => w.connections.filter((r) => r.to === to).map((r) => r.from);
  const more = editWorkflow({ ...sound, nodes: [...sound.nodes, node('f2', 'fork')] }, { connection: { from: 'f2/yes', to: 'g' } }, kinds);
  assert.deepEqual(into(more, 'g'), ['f/yes', 'f/no', 'f2/yes'], 'beside them, in connection order');
  assert.equal(editWorkflow(sound, { connection: { from: 'f/yes', to: 'g' } }, kinds), sound, 'a connection already there changes nothing');
  assert.deepEqual(into(editWorkflow(sound, { connection: { from: 'start/rows', to: 'end' } }, kinds), 'end'), ['start/rows'], 'one input, one connection');
  assert.deepEqual(into(editWorkflow(more, { cut: { from: 'f/no', to: 'g' } }, kinds), 'g'), ['f/yes', 'f2/yes']);
  assert.deepEqual(into(editWorkflow(more, { cut: 'g' }, kinds), 'g'), []);
  // A multi-select row's value is a list; an empty one is no value.
  const ticked = editWorkflow(sound, { node: 'g', row: 'tags', value: 'status' }, kinds);
  assert.deepEqual(ticked.nodes.find((n) => n.id === 'g').values, { tags: ['status'] });
  assert.equal(editWorkflow(ticked, { node: 'g', row: 'tags', value: [] }, kinds).nodes.find((n) => n.id === 'g').values, undefined);
  assert.deepEqual(workflowFaults(ticked, kinds), []);
});

test('ONE rowChoices() gives every list a picklist row reads, one pick or several', () => {
  const facts = { fields: { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' } }, stores: ['customers'], scopes: ['view', 'data'] };
  const values = (control, more = {}, value) => rowChoices({ control, value }, { ...facts, ...more })?.map((c) => c.value);
  const labels = (control, more = {}) => rowChoices({ control }, { ...facts, ...more })?.map((c) => c.label);
  // Field, Sort, Group, Primary, Secondary: the fields, by their names; a field the facts lack is still offered.
  assert.deepEqual(rowChoices({ control: 'field' }, facts), [{ value: 'status', label: 'Status' }, { value: 'seats', label: 'Seats' }]);
  assert.deepEqual(values('field', {}, 'region'), ['status', 'seats', 'region']);
  // Search fields: the same list, several ticked; each own pick it lacks is offered once.
  assert.deepEqual(values('field', {}, ['seats', 'owner', 'owner']), ['status', 'seats', 'owner']);
  // An operator is a Condition's type now (plan 783 D4): no row picks one.
  assert.equal(rowChoices({ control: 'op' }, facts), undefined);
  // Value (list): the field's values.
  assert.deepEqual(values('values', { values: ['active', 'trial'] }), ['active', 'trial']);
  assert.deepEqual(values('unit'), ['day', 'week', 'month', 'year']);
  assert.deepEqual(labels('direction'), ['Ascending', 'Descending']);
  assert.deepEqual(labels('presentation'), ['Default', 'Bar', 'Donut', 'Pie', 'Grid']);
  assert.deepEqual(values('apply'), ['change', 'input']);
  assert.deepEqual(values('store', {}, 'orders'), ['customers', 'orders']);
  assert.deepEqual(values('scope'), ['view', 'data']);
  // A join is an And or an Or now: no row picks one.
  assert.equal(rowChoices({ control: 'join' }), undefined);
  // A Type row reads its family's types: given, in the registry's words; with none, it has no list.
  assert.deepEqual(labels('type', { types: [{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }] }), ['Text', 'Number']);
  assert.equal(rowChoices({ control: 'type' }, facts), undefined);
  // A fixed list offers nothing it lacks; a row with no list has none.
  assert.deepEqual(values('direction', {}, 'up'), ['asc', 'desc']);
  for (const control of ['text', 'number', 'switch', undefined]) assert.equal(rowChoices({ control }, facts), undefined, String(control));
});
