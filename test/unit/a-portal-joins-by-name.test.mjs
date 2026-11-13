/**
 * A PORTAL JOINS BY NAME — Will, 2026-11-05 (TODO 779): "Connect any node to the 'in' portal node and have it come out of
 * any output portal node with the same name/id." And TODO 826: "A portal input should be able to take in multiple
 * connections. Associated portal outs should show each input node row as input rows in the output portal node." An In
 * takes many connections; every Out of its name draws ONE ROW per connection into any In of the name, `@` and its source, labelled
 * from it, and each row is connected on alone, as a Group Input's is (763). ONE resolver reads a row as its source
 * (`portalFlow`): what an output sends, the warnings, the Outgoing JSON and a Preset Filter's compile. A connection from a row
 * whose connection in is gone is kept, unseen. A loop through a row is a loop. A name is local to its graph.
 *
 *   node --test test/unit/a-portal-joins-by-name.test.mjs
 *
 * TRAP T-a-portal-hop-is-resolved-once
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, kindIn, paletteOf, paletteMatch, rowChoices, fitOf } = await import(new URL('node-kinds.js', core));
const { portalFlow, portalLinks, cutNames, ungroupNames, addressRow, addressOf } = await import(new URL('node-portals.js', core));
const { sentFrom, workflowFaults, workflowGraph, editWorkflow, finalGraph, checkWorkflow, readWorkflow, keptConnections } = await import(new URL('workflow.js', core));
const { conditionAt, nodeFlow } = await import(new URL('node-flow.js', core));
const { presetOfEntity } = await import(new URL('preset-filter.js', core));
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));

const facts = { fieldsOf: { customers: { status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } } } };
const source = (id = 's', name = 'customers', y = 0) => ({ id, kind: 'source', x: 0, y, values: { store: name } });
const portal = (id, type, name, x = 300, y = 0) => ({ id, kind: 'portal', x, y, values: { type, ...(name ? { name } : {}) } });
const field = (id, name, x = 600, y = 0) => ({ id, kind: 'field', x, y, values: { field: name } });
const cond = (id, type, b, x = 900, y = 0) => ({ id, kind: 'condition', x, y, values: { type, ...(b === undefined ? {} : { b }) } });
const value = (id, v, y = 400) => ({ id, kind: 'value', x: 0, y, values: { type: 'text', value: v } });
const flow = (nodes, connections) => ({ v: 3, id: 'w', nodes, connections });
const at = (g, id) => g.nodes.find((n) => n.id === id);
/** Each node's warnings, by its id. */
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));
/** An Out's address rows as drawn: its name, its label and its socket's type. */
const rowsOf = (g, id) => at(g, id).rows.filter((r) => addressOf(r.name) !== undefined).map((r) => [r.name, r.label, r.output]);
const lines = (connections) => connections.map((r) => `${r.from} → ${r.to}`);

test('Portal is ONE family in Utils, a workflow\'s alone: an In takes MANY connections on its header; an Out has no header socket, only rows', () => {
  const kind = NODE_KINDS.portal;
  assert.deepEqual([kind.heading, kind.category, kind.icon, kind.graphs, kind.defaultType, Object.keys(kind.types)], ['Portal', 'Utils', 'link-simple', ['workflow'], 'in', ['in', 'out']]);
  assert.deepEqual([kind.types.in.input, kind.types.in.many, kind.types.in.output, kind.types.out.input, kind.types.out.output], ['any', true, undefined, undefined, undefined]);
  assert.deepEqual(kind.types.out.rows.map((r) => [r.name, r.control]), [['name', 'portal']]);
  assert.equal(kindIn(kind, 'query'), undefined);
  assert.deepEqual(paletteOf(NODE_KINDS).find((g) => g.category === 'Utils').items.map((i) => i.id), ['text', 'tag', 'portal']);
  assert.deepEqual(paletteMatch(kind, 'out'), { type: 'out' });
  // "Add a node" from an output offers an In; an input has nothing an Out could send it before a connection reaches its In.
  assert.deepEqual([fitOf(kind, 'object', 'out'), fitOf(kind, 'boolean', 'in')], [{}, undefined]);
  assert.deepEqual(rowChoices({ control: 'portal', value: undefined }, { portals: ['rows', 'Portal 1'] }).map((c) => c.label), ['Pick a name', 'rows', 'Portal 1', 'New name…']);
  // A row's name is `@` and its source: the same connection back, the same row.
  assert.deepEqual([addressRow('s/rows'), addressOf('@s/rows'), addressOf('@c'), addressOf('name')], ['@s/rows', 's/rows', 'c', undefined]);
});

/** A Source's rows and a Value into one In; one Out, its two rows connected on alone: the rows to a Field, the Value to Value B. */
const twoIn = () => flow([
  source(), value('v', 'active'), portal('in', 'in', 'pipe'), portal('o', 'out', 'pipe', 600), field('f', 'status', 900), cond('eq', 'eq', undefined, 1200),
], [{ from: 's/rows', to: 'in' }, { from: 'v/value', to: 'in' }, { from: 'o/@s/rows', to: 'f' }, { from: 'o/@v/value', to: 'eq/b' }, { from: 'f/field', to: 'eq' }]);

test('an In takes many connections; its Out draws a row for each, labelled from its source, typed by it, each connected on alone', () => {
  const w = twoIn();
  assert.deepEqual(workflowFaults(w, undefined, facts), []);
  const g = workflowGraph(w, facts);
  assert.deepEqual(said(g), {});
  assert.deepEqual(rowsOf(g, 'o'), [['@s/rows', 'Source › Results', 'object'], ['@v/value', 'Value › Value', 'value']]);
  // The Out's header sends nothing: it has no socket.
  assert.equal(at(g, 'o').output, undefined);
  assert.equal(at(g, 'o').rows.find((r) => r.name === 'name').hint, '2 rows, from 1 In portal');
  assert.equal(at(g, 'in').many, true);
  // Each row reads as its source: the Field the Source's column; Value B the Value's word, as connected straight.
  assert.deepEqual(sentFrom(w, 'f/field', facts), { kind: 'field', field: { name: 'status', label: 'Status' } });
  assert.equal(at(g, 'eq').rows.find((r) => r.name === 'b').value, 'active');
  assert.deepEqual(nodeFlow(g, 'eq').definition, { where: { field: 'status', op: 'eq', value: 'active' } });
  assert.deepEqual(lines(portalFlow(w.nodes, w.connections).connections).sort(), ['f/field → eq', 's/rows → f', 'v/value → eq/b']);
  // Drawn: the connections as given; none from the In to the Out.
  assert.deepEqual(lines(g.connections), lines(w.connections));
});

test('1-to-many: every Out of the name draws the same rows; many-to-1: an In of each, the rows of both; many-to-many', () => {
  // Two Outs: each draws the In's two rows, each connected on alone.
  const w = flow([...twoIn().nodes, portal('o2', 'out', 'pipe', 600, 300), { id: 'n', kind: 'organise', x: 900, y: 300 }],
    [...twoIn().connections, { from: 'o2/@s/rows', to: 'n' }]);
  const g = workflowGraph(w, facts);
  assert.deepEqual(rowsOf(g, 'o2'), rowsOf(g, 'o'));
  assert.deepEqual(lines(portalFlow(w.nodes, w.connections).connections).filter((r) => r.includes(' → n')), ['s/rows → n']);
  assert.equal(at(g, 'o').rows.find((r) => r.name === 'name').hint, '2 rows, from 1 In portal, with 1 other Out portal');
  // Two Ins of one name, a Condition's True row into each (plan 944): an Out draws both rows; And takes each, a part each.
  const both = flow([
    source(), field('f', 'status'), field('p', 'plan', 600, 200), cond('a', 'eq', 'active'), cond('b', 'eq', 'Pro', 900, 200),
    portal('i1', 'in', 'ok', 1200, 0), portal('i2', 'in', 'ok', 1200, 200), portal('o', 'out', 'ok', 1500), cond('and', 'and', undefined, 1800),
  ], [
    { from: 's/rows', to: 'f' }, { from: 's/rows', to: 'p' }, { from: 'f/field', to: 'a' }, { from: 'p/field', to: 'b' },
    { from: 'a/true', to: 'i1' }, { from: 'b/true', to: 'i2' }, { from: 'o/@a/true', to: 'and' }, { from: 'o/@b/true', to: 'and' }, { from: 'and/true', to: '#out/where' },
  ]);
  const gb = workflowGraph(both, facts);
  // True is a number, 1 or 0: a value socket (plan 944).
  assert.deepEqual(rowsOf(gb, 'o'), [['@a/true', 'Condition › True', 'value'], ['@b/true', 'Condition › True', 'value']]);
  assert.deepEqual(said(gb), {});
  assert.deepEqual(conditionAt(gb, '#out/where').tree, { and: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'plan', op: 'eq', value: 'Pro' }] });
  // Many-to-many: a second Out draws the same two rows; its rows into Or.
  const many = flow([...both.nodes, portal('o2', 'out', 'ok', 1500, 300), cond('or', 'or', undefined, 1800, 300)], [...both.connections, { from: 'o2/@a/true', to: 'or' }, { from: 'o2/@b/true', to: 'or' }]);
  const gm = workflowGraph(many, facts);
  assert.deepEqual(rowsOf(gm, 'o2'), rowsOf(gm, 'o'));
  assert.deepEqual(nodeFlow(gm, 'or').definition, { where: { or: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'plan', op: 'eq', value: 'Pro' }] } });
  // One row into an input that takes one is one connection: nothing reads null, nothing warns. (A workflow has no Where.)
  assert.deepEqual(workflowFaults(flow(many.nodes, many.connections.filter((r) => r.to !== '#out/where')), undefined, facts), []);
});

test('a row keeps its id: a connection in cut, its connection out is kept unseen, no fault, and Save leaves it out; the connection back, it is back', () => {
  const w = twoIn();
  const cut = editWorkflow(w, { cut: { from: 'v/value', to: 'in' } });
  assert.deepEqual(lines(keptConnections(cut)), ['o/@v/value → eq/b']);
  assert.deepEqual(workflowFaults(cut, undefined, facts), []);
  const g = workflowGraph(cut, facts);
  assert.deepEqual(rowsOf(g, 'o'), [['@s/rows', 'Source › Results', 'object']]);
  assert.ok(!lines(g.connections).includes('o/@v/value → eq/b'), 'drawn nowhere');
  assert.equal(at(g, 'eq').rows.find((r) => r.name === 'b').value, undefined);
  assert.deepEqual(lines(finalGraph(cut).connections), ['s/rows → in', 'o/@s/rows → f', 'f/field → eq']);
  // The connection back: the same row, and its connection out draws again.
  const back = editWorkflow(cut, { connection: { from: 'v/value', to: 'in' } });
  assert.deepEqual(keptConnections(back), []);
  assert.equal(at(workflowGraph(back, facts), 'eq').rows.find((r) => r.name === 'b').value, 'active');
  // An Out turned In keeps its row connections unseen too; turned back, they draw again.
  const turned = editWorkflow(w, { node: 'o', row: 'type', value: 'in' });
  assert.deepEqual(lines(keptConnections(turned)), ['o/@s/rows → f', 'o/@v/value → eq/b']);
  assert.deepEqual(workflowFaults(turned, undefined, facts), []);
  assert.deepEqual(keptConnections(editWorkflow(turned, { node: 'o', row: 'type', value: 'out' })), []);
});

test('an Out no In names warns and has no rows; one of no name, too; a row of an Out into an In of another name chains', () => {
  const lone = workflowGraph(flow([portal('o', 'out', 'nope')], []));
  assert.deepEqual(said(lone), { o: [['', 'No In portal is named "nope": it has no rows']] });
  assert.deepEqual(rowsOf(lone, 'o'), []);
  const bare = workflowGraph(flow([portal('o', 'out')], []));
  assert.deepEqual(said(bare), { o: [['', 'It has no name: pick one, or New name…, for a row per connection into its In']] });
  // Out "a"'s row into In "b": Out "b" draws a row for it, "Portal › Source › Rows", and reads as the Source.
  const chain = flow([source(), portal('ia', 'in', 'a'), portal('oa', 'out', 'a', 600), portal('ib', 'in', 'b', 900), portal('ob', 'out', 'b', 1200), field('f', 'status', 1500)],
    [{ from: 's/rows', to: 'ia' }, { from: 'oa/@s/rows', to: 'ib' }, { from: 'ob/@oa/@s/rows', to: 'f' }]);
  const g = workflowGraph(chain, facts);
  assert.deepEqual(rowsOf(g, 'ob'), [['@oa/@s/rows', 'Portal › Source › Results', 'object']]);
  assert.deepEqual(lines(portalFlow(chain.nodes, chain.connections).connections), ['s/rows → f']);
  assert.deepEqual(workflowFaults(chain, undefined, facts), []);
});

test('a loop through a row is a loop', () => {
  // A Condition's rows into an In; its Out's row into a Math Count, whose Result is the Condition's Value B (plan 944).
  const round = flow([source(), field('f', 'status'), cond('c', 'eq'), portal('i', 'in', 'back', 1200), portal('o', 'out', 'back', 1500), { id: 'n', kind: 'math', x: 1800, y: 0, values: { type: 'count' } }],
    [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/rows', to: 'i' }, { from: 'o/@c/rows', to: 'n/rows' }, { from: 'n/result', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(round, undefined, facts), ['its connections run in a loop, through the portal "back"']);
  assert.equal(checkWorkflow(round, undefined, facts), false);
  // Without the row's connect the same graph has none.
  assert.deepEqual(workflowFaults(flow(round.nodes, round.connections.filter((r) => r.from !== 'o/@c/rows')), undefined, facts), []);
});

/** Demos' Active customers Preset Filter, its Field sent through a portal row to its Condition. */
const throughPortal = {
  v: 2, type: 'preset-filter', id: 'portal-active', label: 'Active, through a portal', settings: { source: 'customers' },
  graph: {
    nodes: [source('start'), field('field', 'status', 300), portal('in', 'in', 'status', 600), portal('out', 'out', 'status', 900), cond('status', 'eq', 'active', 1200)],
    // The test's True into the Group Output (plan 944).
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'in' }, { from: 'out/@field/field', to: 'status' }, { from: 'status/true', to: '#out/where' }],
  },
};
const straightFilter = {
  ...throughPortal, id: 'straight-active',
  graph: { nodes: [source('start'), field('field', 'status', 300), cond('status', 'eq', 'active', 1200)], connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'status' }, { from: 'status/true', to: '#out/where' }] },
};

test('a Preset Filter through a portal row compiles to the same preset as the one connected straight', () => {
  const [a, b] = [presetOfEntity(throughPortal, facts), presetOfEntity(straightFilter, facts)];
  assert.ok('preset' in a, JSON.stringify(a));
  assert.deepEqual(a.preset.where, b.preset.where);
  assert.deepEqual(a.preset.where, { status: { eq: 'active' } });
  // Its Where through a row too: the condition still reaches it.
  const where = { ...throughPortal, id: 'via-where', graph: {
    nodes: [...straightFilter.graph.nodes, portal('wi', 'in', 'where', 1500), portal('wo', 'out', 'where', 1800)],
    connections: [...straightFilter.graph.connections.filter((r) => r.to !== '#out/where'), { from: 'status/true', to: 'wi' }, { from: 'wo/@status/true', to: '#out/where' }],
  } };
  assert.deepEqual(presetOfEntity(where, facts).preset.where, b.preset.where);
});

test('Save writes the portals and their row connections, and they read back the same', () => {
  const w = twoIn();
  assert.equal(finalGraph(w), w);
  const back = readWorkflow(JSON.parse(JSON.stringify(w))).workflow;
  assert.deepEqual(back, w);
  assert.deepEqual(rowsOf(workflowGraph(back, facts), 'o'), rowsOf(workflowGraph(w, facts), 'o'));
  assert.equal(checkWorkflow(back, undefined, facts), true);
});

test('Rename renames a name on every portal that holds it: the rows and their connections stay', () => {
  const w = editWorkflow(twoIn(), { renamePortal: { from: 'pipe', to: 'customers' } });
  assert.deepEqual(w.nodes.filter((n) => n.kind === 'portal').map((n) => n.values.name), ['customers', 'customers']);
  assert.deepEqual(rowsOf(workflowGraph(w, facts), 'o'), rowsOf(workflowGraph(twoIn(), facts), 'o'));
  assert.deepEqual(keptConnections(w), []);
  const was = twoIn();
  assert.equal(editWorkflow(was, { renamePortal: { from: 'pipe', to: ' ' } }), was);
  // One Out moved to another name: its rows go, their connections kept unseen; moved back, they draw again.
  const moved = editWorkflow(was, { node: 'o', row: 'name', value: 'other' });
  assert.deepEqual(lines(keptConnections(moved)), ['o/@s/rows → f', 'o/@v/value → eq/b']);
  assert.deepEqual(keptConnections(editWorkflow(moved, { node: 'o', row: 'name', value: 'pipe' })), []);
});

test('a name is local to its graph: a cut name refused; inside, a row from outside comes by the Group Input, and Ungroup gives it back', () => {
  const library = { v: 1, nodes: {} };
  const w = twoIn();
  assert.deepEqual(cutNames(w.nodes, new Set(['o', 'f'])), ['pipe']);
  assert.match(groupNodes(w, ['o', 'f'], library, { label: 'Status' }, undefined, facts).fault, /the portal "pipe" joins picked nodes to others/);
  // The portals and the Field picked; the Source and the Value stay out. Inside, the Out's rows are the Group Input's.
  const made = groupNodes(w, ['in', 'o', 'f'], library, { label: 'Pipe' }, undefined, facts);
  assert.ok(!('fault' in made), made.fault);
  const body = made.library.nodes[made.id];
  assert.deepEqual(body.inputs.map((i) => [i.name, i.label, i.type]), [['s-rows', 'Source › Results', 'object'], ['v-value', 'Value › Value', 'value']]);
  assert.deepEqual(lines(body.connections).sort(), ['#in/s-rows → in', '#in/v-value → in', 'f/field → #out/f-field', 'o/@#in/s-rows → f', 'o/@#in/v-value → #out/o-v-value'].sort());
  assert.deepEqual(body.outputs.map((o) => [o.label, o.type]), [['Value › Value', 'value'], ['Field › Field', 'object']]);
  // Ungroup: the rows by their sources again, the same connections as before.
  const back = ungroupUse(made.workflow, made.use, made.library);
  assert.deepEqual(lines(back.workflow.connections).sort(), lines(w.connections).sort());
  // Beside a portal already named "pipe": the body's comes out as "pipe 2", and its rows with it.
  const beside = { ...made.workflow, nodes: [...made.workflow.nodes, portal('mine', 'in', 'pipe', 0, 900)] };
  assert.deepEqual(ungroupNames(beside.nodes, body.nodes), new Map([['pipe', 'pipe 2']]));
  const out = ungroupUse(beside, made.use, made.library).workflow;
  assert.deepEqual(out.nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values.name]), [['in', 'pipe 2'], ['o', 'pipe 2'], ['mine', 'pipe']]);
  assert.deepEqual(rowsOf(workflowGraph(out, facts), 'o'), rowsOf(workflowGraph(w, facts), 'o'));
});
