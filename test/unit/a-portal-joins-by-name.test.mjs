/**
 * A PORTAL JOINS BY NAME — Will, 2026-11-05 (TODO 779): "Connect any node to the 'in' portal node and have it come out of
 * any output portal node with the same name/id. There can be multiple input and output portal nodes with the same name so
 * we can create many-to-1, 1-to-many, and many-to-many scenarios. There are no connectors between input and output portal
 * nodes." ONE resolver joins each hop (`portalFlow`); every reader of what flows reads it: what an output sends, the
 * warnings, the Outgoing JSON and a Preset Filter's compile. An Out no In names warns and reads null; a loop through a
 * portal is a loop. A name is local to its graph.
 *
 *   node --test test/unit/a-portal-joins-by-name.test.mjs
 *
 * TRAP T-a-portal-hop-is-resolved-once
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, kindIn, paletteOf, paletteMatch, rowChoices, fitOf } = await import(new URL('node-kinds.js', core));
const { portalFlow, portalLinks, cutNames, ungroupNames } = await import(new URL('node-portals.js', core));
const { sentFrom, workflowFaults, workflowGraph, editWorkflow, finalGraph, checkWorkflow, readWorkflow, keptRoutes } = await import(new URL('workflow.js', core));
const { conditionAt, nodeFlow } = await import(new URL('node-flow.js', core));
const { presetOfEntity } = await import(new URL('preset-filter.js', core));
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));

const facts = { fields: { status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } } };
const store = (id = 's', name = 'customers', y = 0) => ({ id, kind: 'source', x: 0, y, values: { store: name } });
const portal = (id, type, name, x = 300, y = 0) => ({ id, kind: 'portal', x, y, values: { type, ...(name ? { name } : {}) } });
const field = (id, name, x = 600, y = 0) => ({ id, kind: 'field', x, y, values: { field: name } });
const cond = (id, type, b, x = 900, y = 0) => ({ id, kind: 'condition', x, y, values: { type, ...(b === undefined ? {} : { b }) } });
const value = (id, v, y = 400) => ({ id, kind: 'value', x: 0, y, values: { type: 'integer', value: v } });
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });
const at = (g, id) => g.nodes.find((n) => n.id === id);
/** Each node's warnings, by its id. */
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

test('Portal is ONE family in Utils, a workflow\'s alone: In takes anything on its header, Out sends from its; a Name row', () => {
  const kind = NODE_KINDS.portal;
  assert.deepEqual([kind.heading, kind.category, kind.icon, kind.graphs, kind.defaultType, Object.keys(kind.types)], ['Portal', 'Utils', 'link-simple', ['workflow'], 'in', ['in', 'out']]);
  assert.deepEqual([kind.types.in.input, kind.types.in.output, kind.types.out.input, kind.types.out.output], ['any', undefined, undefined, 'any']);
  assert.deepEqual(kind.types.in.rows.map((r) => [r.name, r.control, r.input, r.output]), [['name', 'portal', undefined, undefined]]);
  assert.equal(kindIn(kind, 'query'), undefined);
  assert.deepEqual(paletteOf(NODE_KINDS).find((g) => g.category === 'Utils').items.map((i) => i.id), ['text', 'tag', 'portal']);
  assert.deepEqual(paletteMatch(kind, 'out'), { type: 'out' });
  // "Add a node" from any output offers an In; from any input, an Out.
  assert.deepEqual([fitOf(kind, 'object', 'out'), fitOf(kind, 'boolean', 'in'), fitOf(kind, 'value', 'in')], [{}, { type: 'out' }, { type: 'out' }]);
  // Its Name picks a name the graph holds, or New name…, the next free Portal N; with none, Pick a name.
  assert.deepEqual(rowChoices({ control: 'portal', value: undefined }, { portals: ['rows', 'Portal 1'] }), [
    { value: '', label: 'Pick a name' }, { value: 'rows', label: 'rows' }, { value: 'Portal 1', label: 'Portal 1' }, { value: 'Portal 2', label: 'New name…' },
  ]);
  assert.deepEqual(rowChoices({ control: 'portal', value: 'rows' }, { portals: ['rows'] }).map((c) => c.label), ['rows', 'New name…']);
});

/** One Store's rows through a portal, to a Field › Condition and to a Count: 1-to-many. */
const oneToMany = () => flow([
  store(), portal('in', 'in', 'rows'), portal('o1', 'out', 'rows', 600, 0), portal('o2', 'out', 'rows', 600, 300),
  field('f', 'status', 900), { id: 'n', kind: 'collection', x: 900, y: 300, values: { type: 'count' } }, cond('eq', 'eq', 'active', 1200),
], [{ from: 's/rows', to: 'in' }, { from: 'o1', to: 'f' }, { from: 'o2', to: 'n' }, { from: 'f/field', to: 'eq' }]);

test('1-to-many: what reaches an In leaves from every Out of its name, as if routed straight; no line joins the portals', () => {
  const w = oneToMany();
  assert.deepEqual(workflowFaults(w, undefined, facts), []);
  // The Field reads the Store's rows through the portal: its column, as with a straight route.
  assert.deepEqual(sentFrom(w, 'f/field', facts), { kind: 'field', field: { name: 'status', label: 'Status' } });
  const straight = flow([store(), field('f', 'status', 900)], [{ from: 's/rows', to: 'f' }]);
  assert.deepEqual(sentFrom(w, 'f/field', facts), sentFrom(straight, 'f/field', facts));
  // The Count's Rows: nothing reads null; no warning anywhere.
  const g = workflowGraph(w, facts);
  assert.deepEqual(said(g), {});
  // Drawn: the routes as given; none from an In to an Out. Each Out draws the type that reaches it: rows, an object.
  assert.deepEqual(g.routes.map((r) => `${r.from} → ${r.to}`), ['s/rows → in', 'o1 → f', 'o2 → n', 'f/field → eq']);
  assert.deepEqual([at(g, 'o1').output, at(g, 'o2').output, at(g, 'in').input], ['object', 'object', 'any']);
  // Its Name row says how many share it.
  assert.deepEqual(['in', 'o1'].map((id) => at(g, id).rows.find((r) => r.name === 'name').hint), ['Sends to 2 Out portals', 'Sends what reaches 1 In portal, with 1 other Out portal']);
  assert.deepEqual(portalLinks(g.nodes, 'o1'), ['in', 'o2']);
  // The Outgoing JSON reads through it too.
  assert.deepEqual(nodeFlow(g, 'eq').definition, { where: { field: 'status', op: 'eq', value: 'active' } });
  // A Value into one In: each Out's Value B shows it, read only, as a route from the Value would; the route reaches both.
  const sent = flow([
    { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'text', value: 'trial' } }, portal('in', 'in', 'pick'), portal('o1', 'out', 'pick', 600, 0), portal('o2', 'out', 'pick', 600, 300),
    cond('a', 'eq', 'active', 900, 0), cond('b', 'ne', 'churned', 900, 300),
  ], [{ from: 'v/value', to: 'in' }, { from: 'o1', to: 'a/b' }, { from: 'o2', to: 'b/b' }]);
  assert.deepEqual(portalFlow(sent.nodes, sent.routes).routes, [{ from: 'v/value', to: 'a/b', portal: 'pick' }, { from: 'v/value', to: 'b/b', portal: 'pick' }]);
  const shown = workflowGraph(sent, facts);
  assert.deepEqual(['a', 'b'].map((id) => at(shown, id).rows.find((r) => r.name === 'b').value), ['trial', 'trial']);
  assert.equal(at(shown, 'o1').output, 'value');
});

test('many-to-1: into an input that takes several, each is one part; into one that takes one, it reads null and warns', () => {
  // Two tests, each into an In named "ok"; its Out into And: both are its parts.
  const both = flow([
    store(), field('f', 'status'), field('p', 'plan', 600, 200), cond('a', 'eq', 'active'), cond('b', 'eq', 'Pro', 900, 200),
    portal('i1', 'in', 'ok', 1200, 0), portal('i2', 'in', 'ok', 1200, 200), portal('o', 'out', 'ok', 1500), cond('and', 'and', undefined, 1800),
  ], [
    { from: 's/rows', to: 'f' }, { from: 's/rows', to: 'p' }, { from: 'f/field', to: 'a' }, { from: 'p/field', to: 'b' },
    { from: 'a', to: 'i1' }, { from: 'b', to: 'i2' }, { from: 'o', to: 'and' }, { from: 'and', to: '#out/where' },
  ]);
  const g = workflowGraph(both, facts);
  assert.deepEqual(said(g), {});
  assert.equal(at(g, 'o').output, 'boolean');
  assert.deepEqual(conditionAt(g, '#out/where').tree, { and: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'plan', op: 'eq', value: 'Pro' }] });
  // Two values into one Value A, which takes one: null, and why.
  const values = flow([
    value('v1', '1'), value('v2', '2', 600), portal('i1', 'in', 'n', 300, 400), portal('i2', 'in', 'n', 300, 600), portal('o', 'out', 'n', 600, 400),
    { id: 'm', kind: 'math', x: 900, y: 400, values: { type: 'add', a: 5 } },
  ], [{ from: 'v1/value', to: 'i1' }, { from: 'v2/value', to: 'i2' }, { from: 'o', to: 'm/a' }]);
  const m = at(workflowGraph(values), 'm');
  assert.equal(m.rows.find((r) => r.name === 'a').value, null);
  assert.deepEqual(m.warnings, [{ row: 'a', words: 'Value A takes one route; 2 reach it through the portal "n"' }]);
  // Two Stores' rows into a Field's header, which takes one: null, and why. Nothing is a fault: Save does not wait.
  const rows = flow([store('s1'), store('s2', 'devices', 300), portal('i1', 'in', 'rows'), portal('i2', 'in', 'rows', 300, 300), portal('o', 'out', 'rows', 600), field('f', 'status', 900)],
    [{ from: 's1/rows', to: 'i1' }, { from: 's2/rows', to: 'i2' }, { from: 'o', to: 'f' }]);
  assert.deepEqual(said(workflowGraph(rows, facts)), { f: [['', 'Field takes one route; 2 reach it through the portal "rows"']] });
  assert.equal(sentFrom(rows, 'f/field', facts).kind, 'field');
  assert.deepEqual(workflowFaults(rows, undefined, facts), []);
});

test('many-to-many: each Out sends what reaches every In of its name', () => {
  const w = flow([
    store(), field('f', 'status'), field('p', 'plan', 600, 200), cond('a', 'eq', 'active'), cond('b', 'eq', 'Pro', 900, 200),
    portal('i1', 'in', 'ok', 1200, 0), portal('i2', 'in', 'ok', 1200, 200), portal('o1', 'out', 'ok', 1500, 0), portal('o2', 'out', 'ok', 1500, 200),
    cond('and', 'and', undefined, 1800, 0), cond('or', 'or', undefined, 1800, 200),
  ], [
    { from: 's/rows', to: 'f' }, { from: 's/rows', to: 'p' }, { from: 'f/field', to: 'a' }, { from: 'p/field', to: 'b' },
    { from: 'a', to: 'i1' }, { from: 'b', to: 'i2' }, { from: 'o1', to: 'and' }, { from: 'o2', to: 'or' },
  ]);
  const g = workflowGraph(w, facts);
  const parts = [{ field: 'status', op: 'eq', value: 'active' }, { field: 'plan', op: 'eq', value: 'Pro' }];
  assert.deepEqual([nodeFlow(g, 'and').definition, nodeFlow(g, 'or').definition], [{ where: { and: parts } }, { where: { or: parts } }]);
  const resolved = portalFlow(w.nodes, w.routes, () => true).routes.map((r) => `${r.from} →${r.portal ? ` (${r.portal})` : ''} ${r.to}`);
  assert.deepEqual(resolved.filter((r) => r.includes('(ok)')), ['a → (ok) and', 'b → (ok) and', 'a → (ok) or', 'b → (ok) or']);
});

test('an Out no In names warns, and an input only it reaches reads null; an In and an Out of no name link nothing', () => {
  const w = flow([portal('o', 'out', 'nope'), { id: 'm', kind: 'math', x: 600, y: 0, values: { type: 'add', a: 5 } }], [{ from: 'o', to: 'm/a' }]);
  const g = workflowGraph(w);
  assert.deepEqual(said(g), {
    o: [['', 'No In portal is named "nope": it sends nothing']],
    m: [['a', 'Value A reads nothing: no In portal is named "nope"']],
  });
  assert.equal(at(g, 'm').rows.find((r) => r.name === 'a').value, null);
  // Before anything reaches it, its socket is any type. A warning, never a fault.
  assert.equal(at(g, 'o').output, 'any');
  assert.deepEqual(workflowFaults(w), []);
  // With no name: it says to pick one.
  const bare = workflowGraph(flow([portal('o', 'out')], []));
  assert.deepEqual(said(bare), { o: [['', 'It has no name: pick one, or New name…, to send what reaches its In']] });
  assert.equal(at(bare, 'o').rows.find((r) => r.name === 'name').hint, 'Pick a name, or New name…');
});

test('a loop through a portal is a loop; portals that send into their own name are one', () => {
  // A Condition's rows into an In; its Out into a Count, whose count is the Condition's Value B.
  const count = { id: 'n', kind: 'collection', x: 1800, y: 0, values: { type: 'count' } };
  const round = flow([store(), field('f', 'status'), cond('c', 'eq', 'active'), portal('i', 'in', 'back', 1200), portal('o', 'out', 'back', 1500), count],
    [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/rows', to: 'i' }, { from: 'o', to: 'n' }, { from: 'n/count', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(round, undefined, facts), ['its routes run in a loop, through the portal "back"']);
  assert.equal(checkWorkflow(round, undefined, facts), false);
  // A loop into an input that reads null is still one.
  const twice = flow(round.nodes.slice(0, 5), [...round.routes.slice(0, 3), { from: 'o', to: 'f' }]);
  assert.deepEqual(workflowFaults(twice, undefined, facts), ['two routes enter "f", which takes one', 'its routes run in a loop, through the portal "back"']);
  const self = flow([portal('i', 'in', 'x'), portal('o', 'out', 'x', 600)], [{ from: 'o', to: 'i' }]);
  assert.deepEqual(workflowFaults(self), ['the portal "x" sends into itself, in a loop']);
  // Without the portal hop the same graph has no loop: the hop is what made it.
  const cut = flow(round.nodes, round.routes.filter((r) => r.from !== 'o'));
  assert.deepEqual(workflowFaults(cut, undefined, facts), []);
});

/** Demos' Active customers Preset Filter, its Field sent through a portal to its Condition. */
const throughPortal = {
  v: 1, type: 'preset-filter', id: 'portal-active', label: 'Active, through a portal', settings: { source: 'customers' },
  graph: {
    nodes: [store('start'), field('field', 'status', 300), portal('in', 'in', 'status', 600), portal('out', 'out', 'status', 900), cond('status', 'eq', 'active', 1200)],
    routes: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'in' }, { from: 'out', to: 'status' }, { from: 'status', to: '#out/where' }],
  },
};
const straightFilter = {
  ...throughPortal, id: 'straight-active',
  graph: { nodes: [store('start'), field('field', 'status', 300), cond('status', 'eq', 'active', 1200)], routes: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'status' }, { from: 'status', to: '#out/where' }] },
};

test('a Preset Filter through a portal compiles to the same preset as the one routed straight', () => {
  const [a, b] = [presetOfEntity(throughPortal, { fields: facts.fields }), presetOfEntity(straightFilter, { fields: facts.fields })];
  assert.ok('preset' in a, JSON.stringify(a));
  assert.deepEqual(a.preset.where, b.preset.where);
  assert.deepEqual(a.preset.where, { status: { eq: 'active' } });
  // Its Where through a portal too: the condition still reaches it.
  const where = { ...throughPortal, id: 'via-where', graph: {
    nodes: [...straightFilter.graph.nodes, portal('wi', 'in', 'where', 1500), portal('wo', 'out', 'where', 1800)],
    routes: [...straightFilter.graph.routes.filter((r) => r.to !== '#out/where'), { from: 'status', to: 'wi' }, { from: 'wo', to: '#out/where' }],
  } };
  assert.deepEqual(presetOfEntity(where, { fields: facts.fields }).preset.where, b.preset.where);
});

test('Save writes the portals and their routes, and they read back the same', () => {
  const w = oneToMany();
  assert.equal(finalGraph(w), w);
  const back = readWorkflow(JSON.parse(JSON.stringify(w))).workflow;
  assert.deepEqual(back, w);
  assert.deepEqual(sentFrom(back, 'f/field', facts), sentFrom(w, 'f/field', facts));
  assert.equal(checkWorkflow(back, undefined, facts), true);
  // An Out switched to an In keeps its routes in the draft, unseen and no fault; Save leaves them out.
  const turned = editWorkflow(w, { node: 'o1', row: 'type', value: 'in' });
  assert.deepEqual(keptRoutes(turned).map((r) => `${r.from} → ${r.to}`), ['o1 → f']);
  assert.deepEqual(workflowFaults(turned, undefined, facts), []);
  assert.deepEqual(finalGraph(turned).routes.map((r) => `${r.from} → ${r.to}`), ['s/rows → in', 'o2 → n', 'f/field → eq']);
});

test('Rename renames a name on every portal that holds it: its links stay', () => {
  const w = editWorkflow(oneToMany(), { renamePortal: { from: 'rows', to: 'customers' } });
  assert.deepEqual(w.nodes.filter((n) => n.kind === 'portal').map((n) => n.values.name), ['customers', 'customers', 'customers']);
  assert.deepEqual(sentFrom(w, 'f/field', facts), sentFrom(oneToMany(), 'f/field', facts));
  // An empty name, or one no portal holds, is refused: the workflow given.
  const was = oneToMany();
  assert.equal(editWorkflow(was, { renamePortal: { from: 'rows', to: ' ' } }), was);
  assert.equal(editWorkflow(was, { renamePortal: { from: 'none', to: 'x' } }), was);
});

test('a name is local to its graph: Save as Custom Node refuses one cut in two; Ungroup renumbers one the graph holds', () => {
  const library = { v: 1, nodes: {} };
  const w = oneToMany();
  assert.deepEqual(cutNames(w.nodes, new Set(['o1', 'f'])), ['rows']);
  const cut = groupNodes(w, ['o1', 'f'], library, { label: 'Status' }, undefined, facts);
  assert.match(cut.fault, /the portal "rows" joins picked nodes to others: pick every portal of its name, or none/);
  // Every portal of the name picked: it goes inside, and still joins there.
  const made = groupNodes(w, ['in', 'o1', 'o2', 'f', 'n'], library, { label: 'Rows twice' }, undefined, facts);
  assert.ok(!('fault' in made), made.fault);
  // Ungroup beside a portal already named "rows": the body's comes out as "rows 2".
  const beside = { ...made.workflow, nodes: [...made.workflow.nodes, portal('mine', 'in', 'rows', 0, 900)] };
  assert.deepEqual(ungroupNames(beside.nodes, made.library.nodes[made.id].nodes), new Map([['rows', 'rows 2']]));
  const back = ungroupUse(beside, made.use, made.library);
  assert.deepEqual(back.workflow.nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values.name]), [['in', 'rows 2'], ['o1', 'rows 2'], ['o2', 'rows 2'], ['mine', 'rows']]);
  assert.deepEqual(sentFrom(back.workflow, 'f/field', facts).field.name, 'status');
});
