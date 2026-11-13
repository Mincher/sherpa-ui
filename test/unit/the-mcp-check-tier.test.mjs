/**
 * The MCP's check tier over stdio (plan 700 G2): each tool called as a client
 * calls it, with a sound input and a planted fault for each thing it checks,
 * and each problem said in its checker's own words — the schema's, the data
 * layer's reports, check-usage's lines, the store's refusals.
 *
 *   node --test test/unit/the-mcp-check-tier.test.mjs   (sherpa-ui built)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';
import { markupProblems } from '../../scripts/check-usage.mjs';
import { ArrayStore, checkApp, checkPage, onReport, typeFaults, typeSchema, typeStoreOptions, validate } from '../../dist/data.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const client = new Client({ name: 'the-mcp-check-tier', version: '1' });
const work = mkdtempSync(join(tmpdir(), 'the-mcp-check-tier-'));

before(() => client.connect(new StdioClientTransport({
  command: process.execPath, args: [`${ROOT}mcp-server/index.js`], cwd: ROOT, stderr: 'pipe',
})));
after(async () => {
  await client.close();
  rmSync(work, { recursive: true, force: true });
});

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { bad: !!r.isError, text: r.content[0].text };
};
/** Every ```json block of an answer, parsed. */
const blocks = (text) => [...text.matchAll(/````json\n([\s\S]*?)\n````/g)].map((m) => JSON.parse(m[1]));
/** What the data layer itself says while `run` runs. */
const said = (run) => {
  const out = [];
  const undo = onReport((r) => out.push(`${r.message} (${r.code})`));
  try {
    run();
  } finally {
    undo();
  }
  return out;
};

/** A small sound app: one Context with a definition, Views (one with its own markup) and a template; one Settings page. */
const APP = {
  'package.json': '{ "name": "probe", "private": true }',
  'sherpa-usage.json': '{ "own": { "sherpa-button": ["data-by"] } }',
  'app.json': {
    v: 1, product: { name: 'Probe' }, default: 'records',
    contexts: { records: { label: 'Records', template: 'templates/records.html', definition: 'view-schemas/records.json', views: 'views/records-views.json' } },
    settings: { module: 'contexts/settings.js', pages: { profile: { label: 'Profile', template: 'templates/profile.html' } } },
  },
  'templates/records.html': '<sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>\n<sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>\n<sherpa-button data-by="me" data-label="Mine"></sherpa-button>',
  'view-schemas/records.json': {
    v: 1, id: 'records',
    source: { store: 'records', fields: { seats: { label: 'Seats', type: 'number' }, owner: { label: 'Owner' } }, scopes: { data: { offers: 'all', holds: ['owner'] } } },
    ui: { grid: { key: 'id', columns: [{ field: 'owner', header: 'Owner' }] } },
  },
  'views/records-views.json': {
    all: { label: 'All' },
    big: { label: 'Big', template: 'records-views.html#big', ui: { top: { columns: [] } }, query: { v: 1, scopes: { data: { where: { seats: { gte: 50 } } } } } },
  },
  'views/records-views.html': '<template id="big"><sherpa-data-grid id="top"></sherpa-data-grid></template>',
  'contexts/settings.js': 'export function init() {}\n',
  'templates/profile.html': '<sherpa-button data-label="Save"></sherpa-button>',
};
const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
/** The app written into a new folder, with each change: a file's new content, or null for none. */
function writeApp(changes = {}) {
  const dir = mkdtempSync(join(work, 'app-'));
  for (const [file, content] of Object.entries({ ...APP, ...changes })) {
    if (content == null) continue;
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text(content));
  }
  return dir;
}
const page = (file) => text(APP[file]);

test('validate_page: a sound Context\'s three files are sound, and nothing given is refused', async () => {
  const dir = writeApp();
  const { bad, text: out } = await call('validate_page', {
    definition: page('view-schemas/records.json'), views: page('views/records-views.json'),
    template: page('templates/records.html'), folder: join(dir, 'views'), own: '{"sherpa-button":["data-by"]}',
  });
  assert.equal(bad, false);
  assert.match(out, /^## Page "records": sound/);
  for (const part of ['Definition', 'Views', 'Markup', 'ui']) assert.match(out, new RegExp(`\\*\\*${part}\\*\\* — .*: sound`), part);
  assert.equal((await call('validate_page', {})).bad, true);
});

test('validate_page: each planted fault is caught, in its checker\'s own words', async () => {
  const def = structuredClone(APP['view-schemas/records.json']);
  def.source.fields.seats.type = 'bool';
  def.source.scopes.data.fixed = ['region'];
  def.ui.grid.colums = [];
  def.ui.grid.selectedKeys = [];
  def.ui.ghost = { columns: [] };
  const views = structuredClone(APP['views/records-views.json']);
  views.nolabel = { query: { v: 1, scopes: {} } };
  views.big.template = 'records-views.html#gone';
  const template = `${APP['templates/records.html']}\n<sherpa-nope></sherpa-nope><sherpa-metric data-aggregate="avg" data-sise="x"></sherpa-metric>`;
  const { bad, text: out } = await call('validate_page', {
    definition: text(def), views: text(views), template, folder: join(writeApp(), 'views'), own: '{"sherpa-button":["data-by"]}',
  });
  assert.equal(bad, false, 'a check that finds problems has done its work');
  // The schema's words, then checkPage's report, verbatim.
  for (const e of schemaCheck('page.v1.json')(def)) assert.ok(out.includes(e.split(' ')[0]), e);
  assert.match(out, /\/source\/fields\/seats\/type must be equal to one of the allowed values: "text", "number", "date"/);
  const reports = said(() => checkPage(def));
  assert.ok(reports.length);
  for (const r of reports) assert.ok(out.includes(r), r);
  // The Views: views.v1, and a template its file does not hold.
  assert.match(out, /\/nolabel must have required property 'label'/);
  assert.match(out, /View "big" names records-views\.html#gone, and records-views\.html holds no <template id="gone">/);
  // check_usage's own lines.
  const { problems } = markupProblems(template, 'template', { 'sherpa-button': ['data-by'] });
  assert.equal(problems.length, 3);
  for (const p of problems) assert.ok(out.includes(p), p);
  // ui against the specs; the View whose template was not read is not checked.
  assert.match(out, /#grid is a <sherpa-data-grid>, which has no property or method "colums"/);
  assert.match(out, /#grid's "selectedKeys" is read-only on <sherpa-data-grid>/);
  assert.match(out, /#ghost is in no template/);
  assert.match(out, /View "big"'s ui is not checked: its template was not read/);
  assert.doesNotMatch(out, /#top is in no template/);
  assert.equal((await call('validate_page', { definition: '{nope' })).text.includes('definition is not JSON'), true);
});

test('validate_app: an app on disk is sound, every Context and Settings page checked', async () => {
  const { bad, text: out } = await call('validate_app', { path: writeApp() });
  assert.equal(bad, false);
  assert.match(out, /^## App "Probe" \(.*app\.json\): sound/);
  assert.match(out, /### Context "records": sound/);
  assert.match(out, /### Settings: sound/);
  // The project's own hook, from its sherpa-usage.json, so data-by is no problem.
  assert.match(out, /sherpa-usage\.json: sherpa-button data-by/);
});

test('validate_app: each planted fault is caught where it lives, and one Context alone may be checked', async () => {
  const app = structuredClone(APP['app.json']);
  app.default = 'nope';
  app.contexts.records.module = 'contexts/gone.js';
  const def = structuredClone(APP['view-schemas/records.json']);
  def.source.scopes.data.fixed = ['region'];
  const dir = writeApp({
    'app.json': app, 'view-schemas/records.json': def, 'sherpa-usage.json': null,
    'templates/profile.html': '<sherpa-button data-size="huge" data-label="Save"></sherpa-button>',
  });
  const { bad, text: out } = await call('validate_app', { path: join(dir, 'app.json') });
  assert.equal(bad, false);
  for (const r of said(() => checkApp(app))) assert.ok(out.includes(r), r);
  for (const r of said(() => checkPage(def))) assert.ok(out.includes(r), r);
  assert.match(out, /contexts\.records\.module names "contexts\/gone\.js", which is not in the app's folder/);
  // With no sherpa-usage.json, the project's own hook is a problem too.
  assert.match(out, /templates\/records\.html:3 {2}<sherpa-button data-by>/);
  assert.match(out, /templates\/profile\.html:1 {2}<sherpa-button data-size="huge">/);
  const one = await call('validate_app', { path: dir, context: 'records' });
  assert.doesNotMatch(one.text, /### Settings/);
  assert.equal((await call('validate_app', { path: dir, context: 'nope' })).bad, true);
  assert.equal((await call('validate_app', { path: work })).bad, true, 'a folder with no app.json is refused');
});

test('check_usage: markup matches its specs, or each line says why, as check-usage says it', async () => {
  const good = await call('check_usage', { markup: '<sherpa-button data-size="sm" data-by="x">Go</sherpa-button>', own: '{"sherpa-button":["data-by"]}' });
  assert.equal(good.text, '1 tag(s) in markup match their specs.');
  const markup = '<sherpa-button data-size="huge">Go</sherpa-button>\n<button class="sherpa-button" data-type="icon"></button>';
  const bad = await call('check_usage', { markup, name: 't.html' });
  assert.equal(bad.bad, false);
  const { problems } = markupProblems(markup, 't.html');
  assert.equal(problems.length, 2);
  for (const p of problems) assert.ok(bad.text.includes(`- ${p}`), p);
  assert.equal((await call('check_usage', { markup, own: '[1]' })).bad, true);
});

test('describe_data: rows → a type a store is made from, the page\'s own and the need, each checked against its contract', async () => {
  const rows = [
    { id: 1, name: 'Acme', email: 'a@acme.io', status: 'active', seats: 10, created: '2025-01-02', tags: ['a'] },
    { id: 2, name: 'Bolt', email: 'b@bolt.io', status: 'trial', seats: 3, created: '2025-02-03T10:00:00Z', tags: [] },
    { id: 3, name: 'Core', email: 'c@core.io', status: 'active', seats: 55, created: '2025-03-04', tags: ['b'] },
  ];
  const { bad, text: out } = await call('describe_data', { rows: JSON.stringify(rows), task: 'triage', writes: true, id: 'customer' });
  assert.equal(bad, false);
  const [type, own, need] = blocks(out);
  // Conservative: the key; no required, min, max or values from a sample; a list is no field.
  assert.deepEqual(type.fields, {
    id: { label: 'Id', type: 'number' }, name: { label: 'Name' }, email: { label: 'Email', format: 'email' },
    status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' }, created: { label: 'Created', type: 'date', time: true },
  });
  assert.deepEqual(schemaCheck('type.v1.json')(type), []);
  assert.deepEqual(typeFaults(type), []);
  assert.deepEqual(own, { search: ['name', 'email'] }, 'a page searches what every value differs in');
  assert.deepEqual(need, { task: 'triage', rows: 3, fields: 6, dateFields: 1, numberFields: 1, writes: true });
  assert.deepEqual(schemaCheck('pattern.v1.json#/$defs/need')(need), []);
  assert.match(out, /`name` → text; every value differs: a field to search/);
  assert.match(out, /`tags` → left out \(a list/);
  // The store made from it takes every row it was drawn from.
  for (const row of rows) assert.equal((await validate(typeSchema(type), row)).issues, undefined);
});

test('describe_data: a schema\'s promises become the type\'s, and what nothing carries is listed; a bad ask is refused', async () => {
  const doc = {
    openapi: '3.0.0',
    paths: { '/customers': { get: { responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } } } } } } } } },
    components: { schemas: { Customer: {
      type: 'object', required: ['id', 'email'],
      properties: {
        id: { type: 'integer' }, email: { type: 'string', format: 'email' },
        tier: { type: 'string', enum: ['gold', 'silver'], title: 'Tier' },
        seats: { type: 'integer', minimum: 0, maximum: 500, exclusiveMaximum: 1000 },
        since: { type: 'string', format: 'date-time' }, phone: { type: 'string', format: 'phone' },
      },
    } } },
  };
  const { text: out } = await call('describe_data', { schema: JSON.stringify(doc), id: 'customer' });
  assert.match(out, /from GET \/customers → 200 → items → #\/components\/schemas\/Customer/);
  const [type] = blocks(out);
  assert.deepEqual(type.fields, {
    id: { label: 'Id', type: 'number' }, email: { label: 'Email', required: true, format: 'email' },
    tier: { label: 'Tier', values: ['gold', 'silver'] }, seats: { label: 'Seats', type: 'number', min: 0, max: 500 },
    since: { label: 'Since', type: 'date', time: true }, phone: { label: 'Phone' },
  });
  assert.match(out, /- seats: exclusiveMaximum is said by no type field/);
  assert.match(out, /- phone: format phone is said by no type field/);
  assert.equal((await call('describe_data', {})).bad, true);
  assert.equal((await call('describe_data', { rows: '[1]' })).bad, true);
  assert.equal((await call('describe_data', { schema: '{"type":"string"}' })).bad, true);
  assert.match((await call('describe_data', { rows: '[{"name":"a"}]' })).text, /The key, "id", is no field of the data/);
});

test('validate_rows: rows against a type, as the data layer\'s own validate and a store made from it say it', async () => {
  const type = { v: 1, id: 'seat', label: 'Seat', fields: { id: {}, email: { required: true, format: 'email' }, seats: { type: 'number', min: 0 } } };
  const rows = [{ id: 1, email: 'a@b.co', seats: 3 }, { id: 2, email: 'nope', seats: 'x' }, { id: 3, seats: -1, extra: 1 }];
  const { bad, text: out } = await call('validate_rows', { type: JSON.stringify(type), rows: JSON.stringify(rows) });
  assert.equal(bad, false);
  assert.match(out, /^## 2 of 3 row\(s\) refused/);
  for (const row of rows.slice(1)) {
    for (const issue of (await validate(typeSchema(type), row)).issues) assert.ok(out.includes(`\`${issue.path[0]}\`: ${issue.message}`), issue.message);
  }
  const read = await new ArrayStore(rows, typeStoreOptions(type)).load({});
  assert.ok(out.includes(`${read.dropped} row(s) are dropped and ${read.total} reach a component`));
  assert.match(out, /in the rows, not in the type: `extra`/);
  const good = await call('validate_rows', { type: JSON.stringify({ v: 1, id: 's', label: 'S', fields: { id: {}, seats: { type: 'number' } } }), rows: '[{"id":1,"seats":2}]' });
  assert.match(good.text, /^## All 1 row\(s\) pass/);
  // A type is checked first: its schema's words, then the data layer's.
  const shape = await call('validate_rows', { type: JSON.stringify({ v: 1, id: 'x', label: 'X', fields: { id: {}, email: { format: 'emial' } } }), rows: '[{"id":1}]' });
  assert.equal(shape.bad, true);
  assert.match(shape.text, /\/fields\/email\/format must be equal to one of the allowed values/);
  const ends = await call('validate_rows', { type: JSON.stringify({ v: 1, id: 'x', label: 'X', fields: { id: {}, seats: { type: 'number', min: 5, max: 1 } } }), rows: '[{"id":1}]' });
  assert.match(ends.text, /seats: its min is more than its max/);
});

test('validate_app checks the app\'s types: each file a type, its id its key, and a page names only a type the app lists', async () => {
  const app = mkdtempSync(join(work, 'typed-'));
  const write = (file, value) => {
    mkdirSync(dirname(join(app, file)), { recursive: true });
    writeFileSync(join(app, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('app.json', { v: 1, product: { name: 'Typed' }, default: 'devices', contexts: { devices: { label: 'Devices', template: 'devices.html', definition: 'devices.json' } },
    types: { device: 'types/device.json', named: 'types/named.json', bare: 'types/bare.json' } });
  write('devices.html', '<sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>');
  write('devices.json', { v: 1, id: 'devices', source: { store: 'devices', type: 'record' } });
  write('types/device.json', { v: 1, id: 'device', label: 'Device', fields: { id: {}, name: { label: 'Name' } } });
  write('types/named.json', { v: 1, id: 'other', label: 'Other', fields: { id: {} } });
  write('types/bare.json', { v: 1, id: 'bare', label: 'Bare' });
  const { text } = await call('validate_app', { path: app });
  assert.match(text, /types\/named\.json: its id is "other", and app\.json lists it as "named"/);
  assert.match(text, /types\/bare\.json: type\/ must have required property 'fields'/);
  assert.match(text, /contexts\.devices\.definition names the type "record", which app\.json `types` does not list/);
  assert.doesNotMatch(text, /types\/device\.json/);
});

const STARTER = existsSync(`${ROOT}../Sherpa Starter/index.mjs`);
test('scaffold_app gives the Starter\'s files, named, and validate_app finds them sound', { skip: !STARTER && 'no ../Sherpa Starter beside this checkout' }, async () => {
  const { bad, text: out } = await call('scaffold_app', { name: 'My Shop' });
  assert.equal(bad, false);
  const files = Object.fromEntries([...out.matchAll(/### `([^`]+)`\n\n````\n([\s\S]*?)\n````/g)].map((m) => [m[1], m[2]]));
  for (const f of ['index.html', 'app.json', 'AGENTS.md', 'package.json', '.gitignore', '.mcp.json', 'templates/records.html']) assert.ok(f in files, f);
  assert.equal(JSON.parse(files['package.json']).name, 'my-shop');
  const dir = mkdtempSync(join(work, 'scaffold-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${content}\n`);
  }
  const checked = await call('validate_app', { path: dir });
  assert.match(checked.text, /^## App .*: sound/, checked.text);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8')), JSON.parse(readFileSync(`${ROOT}../Sherpa Starter/template/app.json`, 'utf8')));
});

/** A Custom Node, as an entity: Rows in, the rows' Role out. */
const HAS_ROLE = {
  v: 2, type: 'node', id: 'has-role', label: 'Has role',
  graph: { nodes: [{ id: 'f', kind: 'field', x: 0, y: 0, values: { field: 'role' } }], connections: [{ from: '#in/rows', to: 'f' }, { from: 'f/field', to: '#out/role' }] },
  settings: { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'role', label: 'Role', type: 'value' }] },
};

test('check_custom_node: checked as Save checks it; each fault in words; with none, the node it offers; a use of another entity is no fault with the app\'s entities (plan 942 D3 A)', async () => {
  const ok = await call('check_custom_node', { node: JSON.stringify(HAS_ROLE) });
  assert.equal(ok.bad, false);
  assert.match(ok.text, /No fault\. "Has role" is a Custom Node of Custom Nodes, placed as the kind "has-role"\./);
  assert.match(ok.text, /Inputs: Rows \(object\)\. Outputs: Role \(value\)\. Its graph holds 1 node\(s\)\./);
  // A node of no kind: the data layer's words.
  const odd = await call('check_custom_node', { node: JSON.stringify({ ...HAS_ROLE, graph: { ...HAS_ROLE.graph, nodes: [...HAS_ROLE.graph.nodes, { id: 'x', kind: 'nope', x: 0, y: 0 }] } }) });
  assert.match(odd.text, /fault\(s\) in "Has role"/);
  assert.match(odd.text, /"nope"/);
  // A use of another entity: a fault alone; no fault beside the app's entities file.
  const outer = { ...HAS_ROLE, id: 'outer', label: 'Outer', graph: { nodes: [{ id: 'u', kind: 'has-role', x: 0, y: 0 }], connections: [] }, settings: { inputs: [], outputs: [] } };
  assert.match((await call('check_custom_node', { node: JSON.stringify(outer) })).text, /fault\(s\) in "Outer"/);
  const known = await call('check_custom_node', { node: JSON.stringify(outer), entities: JSON.stringify({ v: 3, entities: { 'has-role': HAS_ROLE } }) });
  assert.match(known.text, /No fault\. "Outer"/);
  // A type the file says is known for that call alone.
  const typed = { v: 2, type: 'playbook', id: 'p', label: 'P', graph: { nodes: [] } };
  assert.match((await call('check_custom_node', { node: JSON.stringify(typed), entities: JSON.stringify({ v: 3, types: { playbook: { v: 1, id: 'playbook', label: 'Playbook', category: 'Runbooks', graph: {} } }, entities: {} }) })).text, /No fault\. "P" is a Custom Node of Runbooks, placed as the kind "playbook:p"\./);
  assert.match((await call('check_custom_node', { node: JSON.stringify(typed) })).text, /fault\(s\) in "P"/);
  // The schema's words; not JSON is refused.
  assert.match((await call('check_custom_node', { node: JSON.stringify({ ...HAS_ROLE, routes: [] }) })).text, /entity\.v2: /);
  assert.equal((await call('check_custom_node', { node: '{' })).bad, true);
});
