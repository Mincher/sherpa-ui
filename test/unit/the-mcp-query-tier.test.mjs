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
  ArrayStore, NODE_KINDS, checkPage, defineStores, editWorkflow, graphRequest, onReport, openSource, pageWithQuery,
  queryGraph, valueKey, workflowFaults, workflowGraph,
} from '../../dist/data.js';
import { createDataHandler, nodeHandler } from '../../dist/server.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEMOS = `${ROOT}../Sherpa Demos/app/`;
const demos = existsSync(`${DEMOS}view-schemas/records.json`);
const skip = demos ? false : `no ${DEMOS}: Demos' Records page is read where Demos sits beside this checkout`;
const fromDemos = (path) => JSON.parse(readFileSync(`${DEMOS}${path}`, 'utf8'));
const records = demos ? fromDemos('view-schemas/records.json') : null;
const workflow = demos ? fromDemos('workflows/active-customers.json') : null;

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
async function direct(definition, commands, store = new ArrayStore(rows, { key: 'id' })) {
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
  const { bad, text, json } = await call('query_source', { definition: records, rows, key: 'id', commands: FILTER_AND_SORT, limit: 5 });
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
  const { json } = await call('query_source', { definition: records, rows, key: 'id', commands });
  const source = await direct(records, commands);
  assert.deepEqual(json.groups, source.groups());
  assert.ok(json.groups.length > 1);
  source.close();
});

test('a bad command is the data layer\'s report, under the command that raised it; one it takes for nothing moves nothing', { skip }, async () => {
  // Records holds its Customer fixed in the View: no door lets it go.
  const { bad, text, json } = await call('query_source', { definition: records, rows, key: 'id', commands: [{ scope: 'view', release: 'customer' }] });
  assert.equal(bad, false);
  assert.equal(json.asked[0].changed, false);
  assert.deepEqual(json.asked[0].reports.map((r) => r.code), ['field-fixed']);
  assert.match(text, /- `field-fixed` .*"customer" stays held/);
  assert.ok(json.query.scopes.view.holds.includes('customer'));
  // A command the Query has no word for moves nothing, and the data layer says so. TODO 718
  const none = await call('query_source', { definition: records, rows, key: 'id', commands: [{ scope: 'data', filter: 'status' }] });
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
  const local = await call('query_source', { definition: page, rows, key: 'id', commands });
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

test('query_graph is queryGraph over the opened page, as the Node Editor draws it', { skip }, async () => {
  const commands = [FILTER_AND_SORT[0]];
  const { bad, json } = await call('query_graph', { definition: records, rows, key: 'id', commands });
  assert.equal(bad, false);
  const source = await direct(records, commands);
  const graph = queryGraph(source.query.draft, records, {
    values: (f) => source.valuesFor(f).map((v) => valueKey(v)), presets: (s) => source.query.presets(s),
    domains: source.store.domains ?? {}, pageSize: source.state.pageSize, type: (f) => records.source.fields[f]?.type,
  });
  assert.deepEqual({ nodes: json.nodes, routes: json.routes }, JSON.parse(JSON.stringify(graph)));
  const ids = json.nodes.map((n) => n.id);
  for (const id of ['source', 'scope-view', 'scope-data', 'when-data-status', 'preset-data-high-risk', 'saved-at-risk']) assert.ok(ids.includes(id), id);
  source.close();
});

test('a bad command under query_graph is reported too', { skip }, async () => {
  const { bad, json } = await call('query_graph', { definition: records, rows, key: 'id', commands: [{ scope: 'view', field: 'region', suspended: true }] });
  assert.equal(bad, false);
  assert.deepEqual(json.reports.map((r) => r.code), ['field-always-on']);
});

test('edit_query_graph asks a node\'s command through ask(), and gives the Query and the definition Save writes', { skip }, async () => {
  const edits = [{ node: 'preset-data-high-risk', row: 'on', value: true }];
  const { bad, json } = await call('edit_query_graph', { definition: records, rows, key: 'id', edits });
  assert.equal(bad, false);
  assert.deepEqual(json.edited[0].asked, { scope: 'data', preset: 'high-risk', on: true });
  // The same command, asked directly.
  const source = await direct(records, [{ scope: 'data', preset: 'high-risk', on: true }]);
  assert.equal(json.total, source.total);
  assert.deepEqual(json.query, source.query.draft);
  const saved = pageWithQuery(records, source.query.draft, { pageSize: source.state.pageSize, type: (f) => records.source.fields[f]?.type });
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
  const at = { definition: records, rows, key: 'id', commands: [FILTER_AND_SORT[1]] };
  const { json } = await call('edit_query_graph', { ...at, edits: [{ node: 'when-data-seats', row: 'b', value: '100' }] });
  const source = await direct(records, [FILTER_AND_SORT[1]]);
  const graph = queryGraph(source.query.draft, records);
  const node = graph.nodes.find((n) => n.id === 'when-data-seats');
  const request = graphRequest({ node, row: node.rows.find((r) => r.name === 'b'), value: '100' }, { type: (f) => records.source.fields[f]?.type });
  assert.deepEqual(json.edited[0].asked, request);
  assert.deepEqual(json.definition.source.scopes.data.where, { seats: { gt: 100 } });
  source.close();
});

test('edit_query_graph refuses a dangling node, a row no command takes and a route the Query refuses, in the data layer\'s words', { skip }, async () => {
  const at = { definition: records, rows, key: 'id' };
  const dangling = await call('edit_query_graph', { ...at, edits: [{ node: 'when-view-nope', row: 'b', value: 'x' }] });
  assert.equal(dangling.bad, true);
  assert.match(dangling.text, /^The Query graph has no node "when-view-nope"\. Its nodes: source, scope-view, /);
  const readOnly = await call('edit_query_graph', { ...at, edits: [{ node: 'source', row: 'search', value: 'name' }] });
  assert.equal(readOnly.bad, true);
  assert.match(readOnly.text, /No command takes "Search fields" on "Source": The page definition sets it/);
  const route = await call('edit_query_graph', { ...at, edits: [{ from: 'source', to: 'scope-view/region' }] });
  assert.equal(route.bad, true);
  assert.match(route.text, /The Query has no route from "Source" to "View Context": a condition's True goes into a field of a scope\./);
});

test('workflow_graph is workflowGraph with its faults and the kinds a workflow runs', { skip }, async () => {
  const facts = { fieldsOf: { customers: records.source.fields }, stores: ['customers'] };
  const { bad, json } = await call('workflow_graph', { workflow, ...facts });
  assert.equal(bad, false);
  assert.deepEqual({ nodes: json.nodes, routes: json.routes }, JSON.parse(JSON.stringify(workflowGraph(workflow, facts))));
  assert.deepEqual(json.reports, []);
  assert.deepEqual(Object.keys(json.kinds), Object.keys(NODE_KINDS).filter((k) => NODE_KINDS[k].graphs.includes('workflow')));
  // A route into a node it has not got.
  const ghost = { ...workflow, routes: [...workflow.routes, { from: 'status/value', to: 'ghost/value' }] };
  const faulty = await call('workflow_graph', { workflow: ghost });
  assert.equal(faulty.bad, false);
  assert.deepEqual(faulty.json.reports.map((r) => r.message), workflowFaults(ghost).map((f) => `checkWorkflow: ${f}.`));
  assert.match(faulty.text, /a route enters "ghost\/value", which is no input socket/);
  assert.equal((await call('workflow_graph', { workflow: { id: 'nope' } })).bad, true);
});

test('edit_workflow is editWorkflow, checked; an edit to a node it has not got is refused', { skip }, async () => {
  const edits = [{ node: 'status', row: 'value', value: 'trial' }, { node: 'filter', set: { heading: 'Trials only' } }];
  const { bad, json } = await call('edit_workflow', { workflow, edits });
  assert.equal(bad, false);
  assert.deepEqual(json.workflow, edits.reduce((w, e) => editWorkflow(w, e), workflow));
  assert.deepEqual(json.reports, []);
  const dangling = await call('edit_workflow', { workflow, edits: [{ node: 'ghost', row: 'value', value: 1 }] });
  assert.equal(dangling.bad, true);
  assert.match(dangling.text, /The workflow has no node "ghost", so no edit was made\. Its nodes: start, field, status, filter, end\./);
  // A route made into a node it has not got is made, and checkWorkflow says so.
  const routed = await call('edit_workflow', { workflow, edits: [{ route: { from: 'status/value', to: 'ghost/value' } }] });
  assert.equal(routed.bad, false);
  assert.match(routed.text, /a route enters "ghost\/value", which is no input socket/);
});

test('sherpa://node-kinds is NODE_KINDS as the registry says it', async () => {
  const { contents } = await client.readResource({ uri: 'sherpa://node-kinds' });
  assert.equal(contents[0].mimeType, 'application/json');
  assert.deepEqual(JSON.parse(contents[0].text), JSON.parse(JSON.stringify(NODE_KINDS)));
});
