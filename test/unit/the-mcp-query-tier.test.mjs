/**
 * The MCP's query tier over stdio (plan 700 G3): the server started as a client
 * starts it, each tool called with a good input and a planted fault, and each
 * answer held to the same call made on `sherpa-ui/data` directly. Demos' Records
 * page definition is read where Demos sits beside this checkout, and skipped
 * where it does not. TRAP T-one-command-one-door
 *
 *   node --test test/unit/the-mcp-query-tier.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ArrayStore, NODE_KINDS, checkPage, connectionRequest, defineStores, editWorkflow, entityFaults, graphOfWorkflow, graphRequest,
  graphWorkflow, kindsOf, lensOf, libraryOf, nodeKinds, onReport, openSource, pageWithQuery, queryGraph, queryGraphFaults,
  pageFields, registerEntityType, valueKey, workflowGraph,
} from '../../dist/data.js';
import * as data from '../../dist/data.js';
import { typedStore } from '../../mcp-server/lib/describe.js';
import { createDataHandler, nodeHandler } from '../../dist/server.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// A lane run points SHERPA_DEMOS at its own Demos pair; the default is the one beside this checkout.
const DEMOS = `${(process.env.SHERPA_DEMOS ?? `${ROOT}../Sherpa Demos`).replace(/\/$/, '')}/app/`;
const demos = existsSync(`${DEMOS}view-schemas/records.json`);
const skip = demos ? false : `no ${DEMOS}: Demos' Records page is read where Demos sits beside this checkout`;
const fromDemos = (path) => JSON.parse(readFileSync(`${DEMOS}${path}`, 'utf8'));
const records = demos ? fromDemos('view-schemas/records.json') : null;
// The page names its type (plan 960 U3): the rows are given with it, as the app makes its store, and it is registered
// here too, so what is read directly reads the type's words and kinds as the MCP's call does.
const RECORD = demos ? fromDemos('types/record.json') : null;
const given = RECORD ? { type: RECORD } : { key: 'id' };
const typed = () => ({ rows, ...given });
// Since 760 a workflow is an ENTITY, drawn through its type's lens. Demos registers its Workflow type in
// app/entity-types.js, not in entities.json, so the entities file is given with that type in it.
const WORKFLOW = { v: 1, id: 'workflow', label: 'Workflow', icon: 'circle-nodes', graph: { runs: true } };
const entity = demos ? fromDemos('workflows/active-customers.json') : null;
const app = demos ? fromDemos('entities.json') : null;
const entities = app ? { ...app, types: { ...app.types, workflow: WORKFLOW } } : null;
const others = app ? Object.values(app.entities) : null;
/** The workflow with a connection into a node it has not got. */
const ghost = entity ? { ...entity, graph: { ...entity.graph, connections: [...entity.graph.connections, { from: 'status/value', to: 'ghost/value' }] } } : null;

/** `run` with an entities file's types registered here, as the server registers them; taken back after. */
function withTypes(file, run) {
  const undo = Object.values(file.types ?? {}).flatMap((type) => registerEntityType(type) ?? []);
  try {
    return run();
  } finally {
    for (const back of undo) back();
  }
}

/** Rows for every field Records declares, the same each run; dates counted back from today. */
const STATUS = ['active', 'trial', 'suspended', 'churned'];
const PLAN = ['Free', 'Starter', 'Pro', 'Enterprise'];
const day = (back) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const rows = Array.from({ length: 80 }, (_, i) => ({
  id: i + 1, name: `Person ${i}`, email: `p${i}@example.com`, customer: ['Acme', 'Contoso', 'Globex'][i % 3], site: `Site ${i % 5}`,
  status: STATUS[i % 4], plan: PLAN[(i * 7) % 4], tier: ['Bronze', 'Gold'][i % 2], region: ['EMEA', 'AMER', 'APAC'][i % 3],
  owner: ['Unassigned', 'Ravi Menon'][i % 2], seats: (i * 13) % 200, spend: i * 100, openTickets: i % 5, health: ['Healthy', 'At risk'][i % 2],
  score: 30 + ((i * 17) % 70), created: day(i * 6), lastSeen: day(i),
}));
const FILTER_AND_SORT = [
  { scope: 'data', field: 'status', reading: { picked: ['active', 'trial'] } },
  { scope: 'data', field: 'seats', reading: { tree: { op: 'gt', value: 40 }, mode: 'advanced' } },
  { scope: 'data', sort: 'seats', direction: 'desc' },
];

const client = new Client({ name: 'the-mcp-query-tier', version: '1' });
const unregister = RECORD ? registerEntityType(RECORD) : undefined;
after(() => unregister?.());
before(() => client.connect(new StdioClientTransport({
  command: process.execPath, args: [`${ROOT}mcp-server/index.js`], cwd: ROOT, stderr: 'pipe',
})));
after(() => client.close());

/** A tool's answer: whether it refused, its words, and its JSON. */
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content[0].text;
  const at = text.indexOf('```json\n');
  return { bad: !!r.isError, text, json: at < 0 ? null : JSON.parse(text.slice(at + 8, text.lastIndexOf('```'))) };
}

/** The page opened on the data layer directly, each command asked as a chip asks it. */
async function direct(definition, commands, store = typedStore(data, rows, given)) {
  const source = await openSource(definition.source, store);
  await source.load();
  for (const request of commands) {
    source.query.ask(request);
    await source.load();
  }
  return source;
}

/** A Node host of the data layer over these rows, on a port the system picks; it stops after the test. */
async function serve(t) {
  const handle = createDataHandler({ stores: defineStores(() => ({ customers: new ArrayStore(rows, { key: 'id' }) })), host: 'server' });
  const server = createServer(nodeHandler(handle));
  await new Promise((up) => server.listen(0, '127.0.0.1', up));
  t.after(() => new Promise((down) => { server.closeAllConnections(); server.close(down); }));
  return `http://127.0.0.1:${server.address().port}/`;
}

test('query_source runs Records with a filter and a sort: the total and the order are ask()\'s own', { skip }, async () => {
  const { bad, text, json } = await call('query_source', { definition: records, ...typed(), commands: FILTER_AND_SORT, limit: 5 });
  assert.equal(bad, false, text);
  const source = await direct(records, FILTER_AND_SORT);
  assert.ok(source.total > 0 && source.total < rows.length, `the filter narrows: ${source.total}`);
  assert.equal(json.total, source.total);
  assert.deepEqual(json.rows.map((r) => r.id), source.rows.slice(0, 5).map((r) => r.id));
  assert.deepEqual(json.query, source.query.applied);
  assert.deepEqual(json.filter, source.state.filter);
  assert.deepEqual(json.arrangement.sort, [{ field: 'seats', direction: 'desc' }]);
  // Each command's own total, as the rows narrowed.
  assert.equal(json.asked.length, 3);
  assert.ok(json.asked[0].total >= json.asked[1].total);
  // Each field's state, as every control reads it, and its chip's results.
  assert.equal(json.fields.status.home, 'data');
  assert.equal(json.fields.status.on, true);
  assert.deepEqual(json.fields.status.reading, { picked: ['active', 'trial'] });
  assert.equal(json.fields.status.results, (await source.results('data')).status);
  assert.deepEqual(json.reports, []);
  source.close();
});

test('query_source groups the rows as the source groups them', { skip }, async () => {
  const commands = [{ scope: 'data', group: 'plan' }];
  const { json } = await call('query_source', { definition: records, ...typed(), commands });
  const source = await direct(records, commands);
  assert.deepEqual(json.groups, source.groups());
  assert.ok(json.groups.length > 1);
  source.close();
});

test('a bad command is the data layer\'s report, under the command that raised it; one it takes for nothing moves nothing', { skip }, async () => {
  // Records holds its Customer fixed in the View: no door lets it go.
  const { bad, text, json } = await call('query_source', { definition: records, ...typed(), commands: [{ scope: 'view', release: 'customer' }] });
  assert.equal(bad, false);
  assert.equal(json.asked[0].changed, false);
  assert.deepEqual(json.asked[0].reports.map((r) => r.code), ['field-fixed']);
  assert.match(text, /- `field-fixed` .*"customer" stays held/);
  assert.ok(json.query.scopes.view.holds.includes('customer'));
  // A command the Query has no word for moves nothing, and the data layer says so. TODO 718
  const none = await call('query_source', { definition: records, ...typed(), commands: [{ scope: 'data', filter: 'status' }] });
  assert.equal(none.json.asked[0].changed, false);
  assert.deepEqual(none.json.asked[0].reports.map((r) => r.code), ['unknown-request']);
  assert.match(none.text, /did not move at #1/);
  assert.match(none.text, /- `unknown-request` ask: \{ scope, filter \} names no edit/);
});

test('query_source reads the app\'s data path on this machine, and refuses any other host', async (t) => {
  const page = { v: 1, id: 'people', source: { store: 'customers', fields: { plan: { label: 'Plan' } }, scopes: { data: { holds: ['plan'] } } } };
  const commands = [{ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } }];
  const at = await serve(t);
  const served = await call('query_source', { definition: page, data: at, commands });
  assert.equal(served.bad, false, served.text);
  const local = await call('query_source', { definition: page, ...typed(), commands });
  assert.equal(served.json.total, local.json.total);
  assert.equal(served.json.total, rows.filter((r) => r.plan === 'Pro').length);
  for (const data of ['https://example.com/', 'http://localhost.example.com:4200/', 'http://10.0.0.1/', 'file:///etc/passwd']) {
    const refused = await call('query_source', { definition: page, data, commands });
    assert.equal(refused.bad, true, data);
    assert.match(refused.text, /must be on this machine .* nothing was asked of it/, data);
  }
  // A store the host has not got is its own refusal, in its words.
  const ghost = await call('query_source', { definition: { ...page, source: { ...page.source, store: 'ghosts' } }, data: at });
  assert.equal(ghost.bad, true);
  assert.match(ghost.text, /The store "ghosts" at http:\/\/127\.0\.0\.1:\d+\/sherpa\/data\/ could not be opened/);
});

test('a definition that is not a page is refused in checkPage\'s words', async () => {
  const { bad, text } = await call('query_source', { definition: { id: 'nope' }, rows });
  assert.equal(bad, true);
  assert.match(text, /- `page-definition` checkPage: it is not a v1 page definition\./);
  assert.equal((await call('query_source', { definition: '{ not json', rows })).bad, true);
});

/** The facts the Node Editor draws a page's Query with, read from the page opened here. */
const drawnFacts = (source, definition) => ({
  values: (f) => source.valuesFor(f).map((v) => valueKey(v)), presets: (s) => source.query.presets(s),
  domains: source.store.domains ?? {}, pageSize: source.state.pageSize, type: (f) => pageFields(definition.source)[f]?.type,
});

test('definition_graph draws a page\'s Query as queryGraph draws it over the opened page, and the lens\'s graph of it', { skip }, async () => {
  const commands = [FILTER_AND_SORT[0]];
  const { bad, text, json } = await call('definition_graph', { definition: records, ...typed(), commands });
  assert.equal(bad, false, text);
  const source = await direct(records, commands);
  const facts = drawnFacts(source, records);
  const graph = queryGraph(source.query.draft, records, facts);
  assert.deepEqual({ nodes: json.nodes, connections: json.connections }, JSON.parse(JSON.stringify(graph)));
  const ids = json.nodes.map((n) => n.id);
  for (const id of ['source', 'view-filters', 'presentation-data', 'view', 'when-data-status', 'preset-data-high-risk', 'saved-at-risk']) assert.ok(ids.includes(id), id);
  // The graph the editor edits is the lens's, and its faults are the Query graph's own.
  assert.deepEqual(json.graph, JSON.parse(JSON.stringify(lensOf('query').toGraph(records, { ...facts, query: source.query }).workflow)));
  assert.deepEqual(json.graph.nodes.map((n) => n.id), ids);
  assert.deepEqual(json.faults, queryGraphFaults(graph, facts.domains));
  assert.equal(json.kinds, undefined);
  assert.deepEqual(json.reports, []);
  source.close();
});

test('a bad command under definition_graph is reported too', { skip }, async () => {
  const { bad, json } = await call('definition_graph', { definition: records, ...typed(), commands: [{ scope: 'view', field: 'region', suspended: true }] });
  assert.equal(bad, false);
  assert.deepEqual(json.reports.map((r) => r.code), ['field-always-on']);
});

test('edit_definition_graph asks a node\'s command through ask(), and gives the Query and the definition Save writes', { skip }, async () => {
  const edits = [{ node: 'preset-data-high-risk', row: 'on', value: true }];
  const { bad, text, json } = await call('edit_definition_graph', { definition: records, ...typed(), edits });
  assert.equal(bad, false, text);
  assert.deepEqual(json.edited, [{ edit: edits[0] }]);
  assert.deepEqual(json.faults, []);
  // The command a chip asks, asked directly: the Query moved, and to where that command takes it.
  const untouched = await direct(records, []);
  assert.notDeepEqual(json.query, untouched.query.draft);
  untouched.close();
  const source = await direct(records, [{ scope: 'data', preset: 'high-risk', on: true }]);
  assert.equal(json.total, source.total);
  assert.deepEqual(json.query, source.query.draft);
  const saved = pageWithQuery(records, source.query.draft, { pageSize: source.state.pageSize, type: (f) => pageFields(records.source)[f]?.type });
  assert.deepEqual(json.definition, saved);
  const heard = [];
  const undo = onReport((r) => heard.push(r));
  try {
    assert.equal(checkPage(json.definition), true, heard.map((r) => r.message).join(' | '));
  } finally { undo(); }
  assert.deepEqual(json.reports, []);
  source.close();
});

test('a condition\'s value is the command a chip asks, typed by its field', { skip }, async () => {
  const at = { definition: records, ...typed(), commands: [FILTER_AND_SORT[1]] };
  const { bad, text, json } = await call('edit_definition_graph', { ...at, edits: [{ node: 'when-data-seats', row: 'b', value: '100' }] });
  assert.equal(bad, false, text);
  const source = await direct(records, [FILTER_AND_SORT[1]]);
  const graph = queryGraph(source.query.draft, records);
  const node = graph.nodes.find((n) => n.id === 'when-data-seats');
  const request = graphRequest({ node, row: node.rows.find((r) => r.name === 'b'), value: '100' }, { type: (f) => pageFields(records.source)[f]?.type });
  source.query.ask(request);
  await source.load();
  assert.deepEqual(json.query, source.query.draft);
  assert.equal(json.total, source.total);
  assert.deepEqual(json.definition.source.scopes.data.where, { seats: { gt: 100 } });
  source.close();
});

test('edit_definition_graph refuses a dangling node and a connection the Query refuses, in the data layer\'s words', { skip }, async () => {
  const at = { definition: records, ...typed() };
  const dangling = await call('edit_definition_graph', { ...at, edits: [{ node: 'when-view-nope', row: 'b', value: 'x' }] });
  assert.equal(dangling.bad, true);
  assert.match(dangling.text, /^The graph has no node "when-view-nope", so no edit was made\. Its nodes: source, .*\bview-filters\b/);
  // A connection the Query has no command for refuses the whole graph: nothing is asked, and no definition is written.
  const connection = await call('edit_definition_graph', { ...at, edits: [{ connection: { from: 'source', to: 'view-filters/region' } }] });
  assert.equal(connection.bad, false);
  const source = await direct(records, []);
  const said = connectionRequest(queryGraph(source.query.draft, records, drawnFacts(source, records)), { from: 'source', to: 'view-filters/region' });
  // Its own refusal first; where the row already has its test joined (a chip on All, TODO 965), the cut is refused too.
  assert.equal(connection.json.faults[0], said.refused);
  assert.match(connection.text, /The Query has no connection from "Source" to "View Filters": a filter's Pass goes into a chip of View Filters, or onto a card's rows\./);
  assert.equal(connection.json.definition, undefined);
  assert.deepEqual(connection.json.query, source.query.draft);
  source.close();
});

test('edit_definition_graph refuses a read-only row, in the data layer\'s words, and asks nothing', { skip }, async () => {
  const readOnly = await call('edit_definition_graph', { definition: records, ...typed(), edits: [{ node: 'source', row: 'search', value: 'name' }] });
  assert.equal(readOnly.bad, false, readOnly.text);
  assert.ok(readOnly.json.faults.some((f) => /No command takes "Search fields" on "Source": The page definition sets it/.test(f)), readOnly.text);
  assert.equal(readOnly.json.definition, undefined);
});

test('a page with one of its Views: drawn with the View on its Query, and edits written back as the View (plan 960 U4.6a)', { skip }, async () => {
  const view = fromDemos('views/records-views.json').risk;
  const drawn = await call('definition_graph', { definition: records, view, ...typed() });
  assert.equal(drawn.bad, false, drawn.text);
  const ids = drawn.json.nodes.map((n) => n.id);
  for (const id of ['when-view-health', 'when-data-openTickets', 'when-data-status', 'organise-data']) assert.ok(ids.includes(id), id);
  const edits = [{ node: 'when-data-openTickets', row: 'b', value: '4' }, { node: 'organise-data', row: 'sort', value: 'spend' }];
  const { bad, text, json } = await call('edit_definition_graph', { definition: records, view, ...typed(), edits });
  assert.equal(bad, false, text);
  assert.deepEqual(json.faults, []);
  assert.equal(json.definition.label, view.label);
  const data = json.definition.query.scopes.data;
  assert.deepEqual(data.where.openTickets, { gt: 4 });
  assert.deepEqual(data.where.status, view.query.scopes.data.where.status);
  assert.deepEqual(data.sort, [{ field: 'spend', direction: 'asc' }]);
  // The rest as it was, in the plain form the one writer writes: one value picked is `eq`; a field on All stays All,
  // as All is every value picked, not no filter (Will, 2026-11-13).
  assert.deepEqual(json.definition.query.scopes.view.where, { health: { eq: 'At risk' }, customer: { all: true }, region: { all: true } });
  // A View with no query has nothing to put on its page.
  const none = await call('definition_graph', { definition: records, view: { label: 'Nothing' }, ...typed() });
  assert.equal(none.bad, true);
  assert.match(none.text, /A View is drawn on its page/);
});

test('definition_graph draws a workflow entity through its type\'s lens: workflowGraph, its faults, and the kinds a graph may place', { skip }, async () => {
  const facts = { fieldsOf: { customers: records.source.fields }, stores: ['customers'] };
  const { bad, text, json } = await call('definition_graph', { definition: entity, entities, ...facts });
  assert.equal(bad, false, text);
  // A Workflow's graph is its definition: the lens draws it as it is.
  assert.deepEqual(json.graph, { v: 3, id: entity.id, label: entity.label, ...entity.graph });
  withTypes(entities, () => {
    assert.deepEqual(json.graph, JSON.parse(JSON.stringify(graphWorkflow(entity).workflow)));
    assert.deepEqual({ nodes: json.nodes, connections: json.connections }, JSON.parse(JSON.stringify(workflowGraph(json.graph, facts))));
    assert.deepEqual(Object.keys(json.kinds), Object.keys({ ...nodeKinds(), ...kindsOf(libraryOf(others)) }));
  });
  assert.ok(others.every((e) => `${e.type}:${e.id}` in json.kinds), 'each of the app\'s entities is a kind a graph may place');
  assert.deepEqual(json.faults, []);
  assert.deepEqual(json.reports, []);
  // A connection into a node it has not got: the faults are the entity's check's, as the shelf checks it.
  const faulty = await call('definition_graph', { definition: ghost, entities });
  assert.equal(faulty.bad, false);
  withTypes(entities, () => assert.deepEqual(faulty.json.faults, entityFaults(ghost, { entities: others })));
  assert.match(faulty.text, /a connection enters "ghost\/value", which is no input socket/);
  // No lens draws a bare workflow.v3, an entity of a type the app was not given, or nothing.
  for (const definition of [{ v: 3, id: entity.id, ...entity.graph }, entity, { id: 'nope' }]) {
    const refused = await call('definition_graph', { definition });
    assert.equal(refused.bad, true, JSON.stringify(definition).slice(0, 60));
    assert.match(refused.text, /^No lens draws "/);
  }
});

test('edit_definition_graph is editWorkflow on the entity\'s graph, written back checked; an edit to a node it has not got is refused', { skip }, async () => {
  const edits = [{ node: 'status', row: 'value', value: 'trial' }, { node: 'filter', set: { heading: 'Trials only' } }];
  const { bad, text, json } = await call('edit_definition_graph', { definition: entity, entities, edits });
  assert.equal(bad, false, text);
  withTypes(entities, () => {
    const graph = edits.reduce((w, e) => editWorkflow(w, e), graphWorkflow(entity).workflow);
    assert.deepEqual(json.definition, JSON.parse(JSON.stringify({ ...entity, graph: graphOfWorkflow(graph) })));
  });
  const node = (id) => json.definition.graph.nodes.find((n) => n.id === id);
  assert.equal(node('status').values.value, 'trial');
  assert.equal(node('filter').heading, 'Trials only');
  assert.deepEqual(json.faults, []);
  assert.deepEqual(json.reports, []);
  const dangling = await call('edit_definition_graph', { definition: entity, entities, edits: [{ node: 'ghost', row: 'value', value: 1 }] });
  assert.equal(dangling.bad, true);
  assert.ok(dangling.text.includes(`The graph has no node "ghost", so no edit was made. Its nodes: ${entity.graph.nodes.map((n) => n.id).join(', ')}.`), dangling.text);
  // A connection made into a node it has not got is made on the graph, and the entity's check refuses it: nothing is written.
  const connected = await call('edit_definition_graph', { definition: entity, entities, edits: [{ connection: { from: 'status/value', to: 'ghost/value' } }] });
  assert.equal(connected.bad, false);
  assert.equal(connected.json.definition, undefined);
  withTypes(entities, () => assert.deepEqual(connected.json.faults, entityFaults(ghost, { entities: others })));
  assert.match(connected.text, /a connection enters "ghost\/value", which is no input socket/);
});

test('sherpa://node-kinds is NODE_KINDS as the registry says it', async () => {
  const { contents } = await client.readResource({ uri: 'sherpa://node-kinds' });
  assert.equal(contents[0].mimeType, 'application/json');
  assert.deepEqual(JSON.parse(contents[0].text), JSON.parse(JSON.stringify(NODE_KINDS)));
});

test('definition_graph and edit_definition_graph take the app\'s entities: a use of one in a workflow is a Custom Node, no fault (plan 942 D3 A)', async () => {
  const HAS_ROLE = {
    v: 3, type: 'node', id: 'has-role', label: 'Has role',
    graph: { nodes: [{ id: 'f', kind: 'field', x: 0, y: 0, values: { field: 'role' } }], connections: [{ from: '#in/rows', to: 'f' }, { from: 'f/field', to: '#out/role' }] },
    settings: { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'role', label: 'Role', type: 'value' }] },
  };
  const placed = {
    v: 3, type: 'workflow', id: 'w', label: 'Roles',
    graph: {
      nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'u', kind: 'has-role', x: 360, y: 0 }],
      connections: [{ from: 's/rows', to: 'u/rows' }],
    },
  };
  const types = { workflow: WORKFLOW };
  const alone = await call('definition_graph', { definition: placed, entities: { v: 3, types } });
  assert.equal(alone.bad, false, alone.text);
  assert.ok(alone.json.faults.some((f) => /has-role/.test(f)), 'alone, its kind is unknown');
  const known = JSON.stringify({ v: 3, types, entities: { 'has-role': HAS_ROLE } });
  const drawn = await call('definition_graph', { definition: placed, entities: known });
  assert.deepEqual(drawn.json.faults, []);
  assert.deepEqual(drawn.json.reports, []);
  assert.equal(drawn.json.kinds['has-role'].heading, 'Has role');
  assert.deepEqual(drawn.json.nodes.find((n) => n.id === 'u').rows.map((r) => r.name), ['rows', 'role']);
  const edited = await call('edit_definition_graph', { definition: placed, entities: known, edits: [{ node: 'u', set: { heading: 'Role of each' } }] });
  assert.deepEqual(edited.json.faults, []);
  assert.deepEqual(edited.json.reports, []);
  assert.equal(edited.json.definition.graph.nodes.find((n) => n.id === 'u').heading, 'Role of each');
});
