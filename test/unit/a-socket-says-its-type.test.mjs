/**
 * A SOCKET SAYS ITS TYPE: a value, an object, a boolean, or — an input only — any.
 * One function, accepts(), says which output an input reads as its own; the registry says
 * each socket's type, whether an input takes many routes, and whether a node forks
 * into True (its header) and False (`node/#false`). Any route joins any input (TODO
 * 770): one of another type reads null, and its node warns; workflowFaults refuses
 * only a socket that is not there. One rowChoices() says every list a picklist row reads. A
 * node's data comes in on its header, of any type, and leaves its Rows row; each
 * kind a workflow runs forks. Will, TODO 713 (D1, D2, D4, D17) · plan 713 M1, M3.
 * TRAP T-a-socket-says-its-type
 *
 *   node --test test/unit/a-socket-says-its-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, FALSE_SOCKET, ROWS, accepts, kindNode, resolveKind, rowChoices, socketType, takesMany, truthy } = await import(new URL('node-kinds.js', core));
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
  // A fork: any comes in (D1); True on its header, False on its footer.
  fork: { heading: 'Fork', icon: 'function', input: 'any', branches: true, rows: [{ name: 'rows', label: 'Rows', input: 'object', output: 'object' }], model: 'fork', graphs: ['workflow'] },
  // Booleans in, many; a multi-select row: one object in, one out (D17).
  gate: {
    heading: 'Gate', icon: 'flag', input: 'boolean', many: true, model: 'gate', graphs: ['workflow'],
    rows: [{ name: 'tags', label: 'Tags', control: 'field', multiple: true, input: 'object', output: 'object' }, { name: 'note', label: 'Note', input: 'value' }],
  },
  log: { heading: 'Log', icon: 'flag', input: 'any', many: true, rows: [], model: 'log', graphs: ['workflow'] },
  odd: { heading: 'Odd', icon: 'flag', output: 'any', rows: [], model: 'odd', graphs: ['workflow'] },
};

test('the registry says each socket: a row\'s, the header\'s — True where it forks — and the footer\'s False', () => {
  assert.equal(FALSE_SOCKET, '#false');
  assert.equal(socketType(kinds.fork, undefined, 'input'), 'any');
  assert.equal(socketType(kinds.fork, undefined, 'output'), 'boolean');
  assert.equal(socketType(kinds.fork, '#false', 'output'), 'boolean');
  assert.equal(socketType(kinds.fork, '#false', 'input'), undefined, 'False is an output only');
  assert.equal(socketType(kinds.fork, 'rows', 'input'), 'object');
  assert.equal(socketType(NODE_KINDS.output, '#false', 'output'), undefined, 'no fork, no False');
  assert.equal(socketType(NODE_KINDS.output, undefined, 'output'), undefined, 'the end sends nothing');
  assert.equal(socketType(NODE_KINDS.condition, undefined, 'output'), 'boolean', 'a Condition\'s True');
  assert.equal(takesMany(kinds.gate), true);
  assert.equal(takesMany(kinds.gate, 'tags'), false);
  assert.equal(takesMany(NODE_KINDS.output), false);
  // A drawn node carries its fork and its many, for the footer and the tip to read.
  const drawn = kindNode(kinds, 'gate', 'g', []);
  assert.deepEqual([drawn.many, kindNode(kinds, 'fork', 'f', []).branches, kindNode(NODE_KINDS, 'output', 'x', []).branches], [true, true, undefined]);
  // A drawn node says its sockets as its kind does.
  assert.equal(socketType(kindNode(NODE_KINDS, 'condition', 'x', resolveKind(NODE_KINDS.condition).rows), 'rows', 'output'), 'object');
});

test('the rows come in on the header, of ANY type (D1), and leave a Rows row that only sends; only Condition forks (TODO 831)', () => {
  assert.deepEqual(ROWS, { name: 'rows', label: 'Rows', output: 'object', gives: 'rows' });
  const all = Object.entries(NODE_KINDS);
  // A header input takes any; no header sends rows: a Rows row does, first.
  for (const [name, kind] of all) {
    assert.ok([undefined, 'any'].includes(kind.input), `${name}: its header takes any`);
    assert.ok([undefined, 'boolean'].includes(kind.output), `${name}: no header sends rows`);
    const at = kind.rows.findIndex((r) => r.name === ROWS.name);
    // A Source's Rows leave from its Store row: drawn beside it, not a line of its own (TODO 830).
    if (at >= 0) assert.deepEqual([at, kind.rows[at]], [0, name === 'source' ? { ...ROWS, beside: 'store' } : ROWS], `${name}: its Rows row, first`);
  }
  const named = (test) => all.filter(([, k]) => test(k)).map(([n]) => n);
  assert.deepEqual(named((k) => k.rows.some((r) => r.name === ROWS.name)), ['source', 'status', 'scope', 'arrange', 'presentation', 'sort', 'group']);
  // A family's types say their own rows: every Logic type, a Sort, a Group by and a Tag send theirs from a Rows row, first.
  const typed = all.flatMap(([n, k]) => Object.entries(k.types ?? {}).map(([t, type]) => [`${n} › ${t}`, type.rows ?? []]));
  for (const [name, rows] of typed) if (rows.includes(ROWS)) assert.equal(rows.indexOf(ROWS), 0, `${name}: its Rows row, first`);
  assert.deepEqual(typed.filter(([, rows]) => rows.includes(ROWS)).map(([name]) => name), [
    ...Object.keys(NODE_KINDS.condition.types).map((t) => `condition › ${t}`), 'tag › includes',
  ]);
  // True and False: Condition alone for now (Will, TODO 831); `branches` stays an option any kind may take again. A check that sends
  // a boolean, and no False, says `output`: a Preset and a Saved filter (a scope's row), a Time and a Tag.
  assert.deepEqual(named((k) => k.branches), ['condition']);
  assert.deepEqual(named((k) => k.output === 'boolean'), ['preset', 'saved', 'time', 'tag']);
  // A type forks as its family does, and a header sends rows from no type: a portal's Out sends from its rows (TODO 826).
  // Only Logic's header takes by its type, rows, booleans, none; and a portal's, an In anything, many.
  for (const [name, kind] of all) for (const type of Object.values(kind.types ?? {})) assert.deepEqual([type.branches, type.output], [undefined, undefined], name);
  assert.deepEqual(all.filter(([, k]) => Object.values(k.types ?? {}).some((t) => t.input)).map(([n]) => n), ['condition', 'portal']);
  // A comparison tests what comes in on its header (plan 783 D3): a Field's column, or a value.
  assert.deepEqual(['and', 'not', 'empty', 'eq'].map((t) => [NODE_KINDS.condition.types[t].input, NODE_KINDS.condition.types[t].many]), [['boolean', true], ['boolean', undefined], ['any', undefined], ['any', undefined]]);
  assert.equal(NODE_KINDS.condition.types.rows, undefined, 'Rows that hold is gone (plan 783 D4)');
  // No fork: every other kind a workflow runs, the end and a portal, which passes on what reaches it (TODO 779), among them.
  assert.deepEqual(named((k) => k.graphs.includes('workflow') && !k.branches), ['source', 'value', 'field', 'math', 'time', 'collection', 'text', 'tag', 'portal', 'output']);
});

test('every shipped kind says its types once: no output sends any; a fork says no output of its own; a multi-select row is an object, one route in', () => {
  for (const [name, kind] of Object.entries(NODE_KINDS)) {
    assert.notEqual(kind.output, 'any', name);
    if (kind.branches) assert.equal(kind.output, undefined, `${name}: its header's output is True`);
    else if (kind.output) assert.equal(kind.output, 'boolean', `${name}: a header sends a boolean or nothing`);
    for (const row of kind.rows) {
      assert.notEqual(row.output, 'any', `${name}/${row.name}`);
      if (!row.multiple) continue;
      assert.ok([undefined, 'object'].includes(row.input) && [undefined, 'object'].includes(row.output), `${name}/${row.name}: a set is an object`);
      assert.equal(row.many, undefined, `${name}/${row.name}: one set comes in`);
    }
  }
});

// Sound: rows into the fork; its True and its False into a gate that takes many.
const node = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const sound = {
  v: 2, id: 'typed',
  nodes: [node('start', 'source'), node('v', 'value'), node('f', 'fork'), node('g', 'gate'), node('l', 'log'), node('c', 'group'), node('end', 'output')],
  routes: [
    { from: 'start/rows', to: 'f/rows' }, { from: 'f', to: 'g' }, { from: 'f/#false', to: 'g' },
    { from: 'f/rows', to: 'end' }, { from: 'v/value', to: 'l' }, { from: 'c/count', to: 'l' }, { from: 'start/rows', to: 'c' },
  ],
};
const planted = (change) => workflowFaults({ ...structuredClone(sound), ...change }, kinds);

test('a sound typed workflow has no fault, and its schema takes `node/#false`', () => {
  assert.deepEqual(workflowFaults(sound, kinds), []);
  assert.deepEqual(schemaCheck('workflow.v2.json')(sound), []);
  const socket = schemaCheck('defs.v1.json#/$defs/socket');
  assert.deepEqual(socket('f/#false'), []);
  assert.notDeepEqual(socket('f/#true'), [], 'only the footer\'s False is a # part');
  assert.notDeepEqual(socket('f/#false/more'), []);
});

test('a route of another type joins, no fault: the input reads null, and its node warns in words (TODO 770)', () => {
  const nodes = [...sound.nodes, node('x', 'value', { value: 'x' })];
  const cases = [
    [{ from: 'f', to: 'g/tags' }, 'Tags takes a list; it was given a boolean'],
    [{ from: 'start/rows', to: 'g/note' }, 'Note takes a value; it was given rows'],
    // A typed header needs its type: a Gate's, a boolean.
    [{ from: 'x/value', to: 'g' }, 'Gate takes a boolean; it was given "x"'],
    // A multi-select row takes one set: an object, never a value (D17).
    [{ from: 'x/value', to: 'g/tags' }, 'Tags takes a list; it was given "x"'],
  ];
  for (const [route, words] of cases) {
    const w = { ...structuredClone(sound), nodes, routes: [...sound.routes, route] };
    assert.deepEqual(workflowFaults(w, kinds), [], `${route.from} → ${route.to} is no fault`);
    assert.deepEqual(workflowGraph(w, {}, kinds).nodes.find((n) => n.id === 'g').warnings?.map((x) => x.words), [words]);
  }
  // A True into a value row reads as the word, true or false: COERCIONS, no warning (TODO 781).
  const word = { ...structuredClone(sound), nodes, routes: [...sound.routes, { from: 'f', to: 'g/note' }] };
  assert.deepEqual([workflowFaults(word, kinds), workflowGraph(word, {}, kinds).nodes.find((n) => n.id === 'g').warnings], [[], undefined]);
});

test('a socket that is not there is refused, in words; so is an output that says it sends any type', () => {
  const nodes = sound.nodes;
  const cases = [
    [[{ from: 'end/#false', to: 'g' }], 'a route leaves "end/#false", which is no output socket'],
    [[{ from: 'f', to: 'g/#false' }], 'a route enters "g/#false", which is no input socket'],
  ];
  for (const [routes, said] of cases) assert.ok(planted({ routes: [...sound.routes, ...routes] }).includes(said), `${said} — heard: ${planted({ routes: [...sound.routes, ...routes] }).join(' | ')}`);
  const odd = planted({ nodes: [...nodes, node('o', 'odd')], routes: [...sound.routes, { from: 'o', to: 'l' }] });
  assert.ok(odd.includes('a route leaves "o", which sends any type: an output says the one it sends'), odd.join(' | '));
});

test('a second route into an input that is not `many` is a fault; into a `many` one it is not, unless it is the same route; any type joins an any', () => {
  assert.ok(planted({ routes: [...sound.routes, { from: 'start/rows', to: 'g/tags' }, { from: 'f/rows', to: 'g/tags' }] }).includes('two routes enter "g/tags", which takes one'));
  assert.ok(planted({ routes: [...sound.routes, { from: 'f', to: 'g' }] }).includes('the route "f" → "g" is there twice'));
  // An any input that takes many: values from two nodes join, and an object beside them too (TODO 770).
  assert.deepEqual(planted({ routes: sound.routes.filter((r) => r.to !== 'l').concat({ from: 'v/value', to: 'l' }, { from: 'c/count', to: 'l' }) }), []);
  const mixed = { ...structuredClone(sound), routes: [...sound.routes, { from: 'start/rows', to: 'l' }] };
  assert.deepEqual([workflowFaults(mixed, kinds), workflowGraph(mixed, {}, kinds).nodes.find((n) => n.id === 'l').warnings], [[], undefined]);
  // A multi-select row holds a list.
  assert.ok(planted({ nodes: [...sound.nodes.filter((n) => n.id !== 'g'), node('g', 'gate', { tags: 'status' })] }).includes('the node "g" holds "status" as its Tags, which is no list'));
});

test('an edit keeps every route into a `many` input, replaces the one into any other, and cuts one route or all', () => {
  const into = (w, to) => w.routes.filter((r) => r.to === to).map((r) => r.from);
  const more = editWorkflow({ ...sound, nodes: [...sound.nodes, node('f2', 'fork')] }, { route: { from: 'f2', to: 'g' } }, kinds);
  assert.deepEqual(into(more, 'g'), ['f', 'f/#false', 'f2'], 'beside them, in route order');
  assert.equal(editWorkflow(sound, { route: { from: 'f', to: 'g' } }, kinds), sound, 'a route already there changes nothing');
  assert.deepEqual(into(editWorkflow(sound, { route: { from: 'start/rows', to: 'end' } }, kinds), 'end'), ['start/rows'], 'one input, one route');
  assert.deepEqual(into(editWorkflow(more, { cut: { from: 'f/#false', to: 'g' } }, kinds), 'g'), ['f', 'f2']);
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
