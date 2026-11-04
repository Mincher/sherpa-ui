/**
 * The MCP's compose tier over stdio (plan 700 G4, TODO 77): Sherpa's three
 * patterns each pass checkPattern; a planted fault per check is refused, in its
 * checker's words; pick_pattern ranks three needs as each pattern's `when` says,
 * and an app's own pattern replaces Sherpa's; generate_page's files pass
 * validate_page and validate_app, and its page's total through query_source is
 * the rows given. TRAP T-a-pattern-is-checked-by-the-contracts-it-reuses
 *
 *   node --test test/unit/the-mcp-compose-tier.test.mjs   (sherpa-ui built)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';
import { checkPattern } from '../../mcp-server/lib/pattern.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const disk = (path) => readFileSync(`${ROOT}${path}`, 'utf8');
const PATTERNS = ['records-list', 'settings-form', 'filter-scopes'];
const pattern = (id) => JSON.parse(disk(`patterns/${id}.json`));
const client = new Client({ name: 'the-mcp-compose-tier', version: '1' });
const work = mkdtempSync(join(tmpdir(), 'the-mcp-compose-tier-'));

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
/** Every file an answer gives, by the path its heading names. */
const files = (text) => Object.fromEntries([...text.matchAll(/### `([^`]+)`\n\n````\w*\n([\s\S]*?)\n````/g)].map((m) => [m[1], m[2]]));
/** The picked ids, in rank order, from pick_pattern's JSON. */
const picked = (text) => JSON.parse(text.split('````json\n').at(-1).split('\n````')[0]).picked.map((p) => p.id);

/** Rows for a list of customers, the same each run: dates counted back from today. */
const day = (back) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const ROWS = Array.from({ length: 64 }, (_, i) => ({
  id: i + 1, name: `Customer ${i}`, plan: ['Free', 'Pro', 'Enterprise'][i % 3], owner: ['Ravi', 'Ana'][i % 2],
  seats: (i * 13) % 200, score: (i * 17) % 100, created: day(i * 5),
}));
const HEALTH = { health: { type: 'status', label: 'Health', values: [{ value: 'At risk', status: 'critical', when: [{ score: { lt: 40 } }] }, { value: 'Healthy' }] } };

test('each of Sherpa\'s patterns is a pattern by pattern.v1.json and passes checkPattern', async () => {
  for (const id of PATTERNS) {
    assert.deepEqual(schemaCheck('pattern.v1.json')(pattern(id)), [], id);
    const { problems, roles } = await checkPattern(pattern(id));
    assert.deepEqual(problems, [], id);
    for (const role of pattern(id).agent.keeps) assert.ok(roles.some((r) => r.role === role), `${id} keeps ${role}`);
  }
});

/** A pattern with one fault planted, given to generate_page whole: refused, with the fault in its checker's words. */
async function refused(id, plant, said) {
  const broken = pattern(id);
  plant(broken);
  const { bad, text } = await call('generate_page', { pattern: broken, id: 'probe', rows: ROWS, task: 'triage', writes: true });
  assert.equal(bad, true, text);
  assert.match(text, /cannot make this page: 1 problem\(s\)/);
  assert.match(text, said);
}

test('a planted fault per check is refused, where it is and in its checker\'s words', async () => {
  // An element that is no component and no native one.
  await refused('records-list', (p) => { p.layout.children[0].el = 'sherpa-metrik'; }, /layout\.children\[0\]: <sherpa-metrik> is no Sherpa component/);
  // An attribute its component does not declare: check-usage's own words.
  await refused('records-list', (p) => { p.layout.children[2].children[0].children[2].attrs['data-colour'] = 'red'; },
    /layout\.children\[2\]\.children\[0\]\.children\[2\]: <sherpa-data-grid data-colour> — sherpa-data-grid has no such attribute/);
  // A child in a slot that does not accept it: a card's header slot takes a header, not a filter bar.
  await refused('filter-scopes', (p) => { p.layout.children[3].children.push({ el: 'sherpa-quick-filter-toolbar', attrs: { slot: 'header' } }); },
    /<sherpa-container>'s "header" slot accepts header, and <sherpa-quick-filter-toolbar> is content, panel, toolbar, control/);
  // A role whose component cannot draw what it stands for: a donut of each number field.
  await refused('filter-scopes', (p) => { p.layout.children[2].each = 'numberField'; },
    /<sherpa-radial-chart> asks for segments, the rows split by a list's values — never a number's or a date's, so it cannot draw one numberField/);
  // A page checkPage refuses: a fixed field its scope does not hold, in the data layer's words.
  await refused('records-list', (p) => { p.page.scopes.data.fixed = ['{dateField}']; },
    /page: checkPage: page "records-list": scope "data"'s fixed names "dateField", which it does not hold\. \(fixed-field-not-held\)/);
  // agent.keeps naming a role the layout has not got.
  await refused('settings-form', (p) => { p.agent.keeps.push('preview'); }, /agent\.keeps names "preview", which is no role of the layout/);
});

test('checkPattern also refuses a slot that is not there, a node the need cannot fill, and a field a pattern names', async () => {
  const grid = pattern('records-list');
  grid.layout.children[2].children[0].children[2].children = [{ el: 'span' }];
  assert.match((await checkPattern(grid)).problems.join('\n'), /<sherpa-data-grid> has no default slot, so <span> is never shown/);
  const named = pattern('filter-scopes');
  named.page.scopes.view.holds.push('created');
  assert.match((await checkPattern(named)).problems.join('\n'), /"created" names a field, and a pattern's fields are the data's/);
  // A role agent.keeps stands for each status field, and the need has none.
  const kept = pattern('filter-scopes');
  kept.agent.keeps.push('by-status');
  const { problems } = await checkPattern(kept, { need: { task: 'browse', rows: 100, fields: 4, dateFields: 1, numberFields: 1, statusFields: 0 } });
  assert.deepEqual(problems, ['layout.children[2]: by-status stands for each statusField, and the need has none, and agent.keeps it']);
});

test('pick_pattern ranks three needs as each pattern\'s when says, with each part', async () => {
  const triage = await call('pick_pattern', { need: { task: 'triage', rows: 4200, fields: 9, dateFields: 1, numberFields: 3, writes: true } });
  assert.deepEqual(picked(triage.text), ['records-list', 'filter-scopes']);
  assert.match(triage.text, /`writes` \{"eq":true\}: true — holds/);
  assert.match(triage.text, /- \*\*settings-form\*\* \(Sherpa's patterns\/settings-form\.json\): `task` .*: "triage" — does not hold/);
  const browse = await call('pick_pattern', { need: JSON.stringify({ task: 'browse', rows: 4200, fields: 9, writes: false }) });
  assert.deepEqual(picked(browse.text), ['filter-scopes']);
  assert.match(browse.text, /\*\*records-list\*\* .*`writes` \{"eq":true\}: false — does not hold/);
  const settings = await call('pick_pattern', { need: { task: 'settings', rows: 1, fields: 3, writes: true } });
  assert.deepEqual(picked(settings.text), ['settings-form']);
  // A need that is none is refused in its contract's words.
  const wrong = await call('pick_pattern', { need: { rows: -1 } });
  assert.equal(wrong.bad, true);
  assert.match(wrong.text, /\/rows must be >= 0/);
});

test('an app\'s own patterns: beside its app.json, picked with Sherpa\'s, and one of the same id replaces Sherpa\'s', async () => {
  const app = mkdtempSync(join(work, 'app-'));
  const write = (file, value) => {
    mkdirSync(dirname(join(app, file)), { recursive: true });
    writeFileSync(join(app, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  };
  write('app.json', { v: 1, product: { name: 'Probe' }, contexts: {} });
  write('patterns/records-list.json', { ...pattern('records-list'), label: 'Our records', rank: 5 });
  write('patterns/board.json', { ...pattern('filter-scopes'), id: 'board', label: 'A board', rank: 30 });
  write('patterns/broken.json', '{ "v": 1,');
  const { text } = await call('pick_pattern', { need: { task: 'triage', rows: 4200, fields: 9, writes: true }, app });
  assert.deepEqual(picked(text), ['board', 'filter-scopes', 'records-list']);
  assert.match(text, /\*\*records-list\*\* — Our records \(rank 5; the app's patterns\/records-list\.json, in place of Sherpa's patterns\/records-list\.json\)/);
  assert.match(text, /### Refused: not a pattern by pattern\.v1\.json\n\n- the app's patterns\/broken\.json\n {2}- patterns\/broken\.json is not JSON/);
  // generate_page reads the same patterns.
  const board = await call('generate_page', { pattern: 'board', id: 'board', rows: ROWS, app });
  assert.equal(board.bad, false, board.text);
  assert.match(board.text, /from the pattern "board" \(the app's patterns\/board\.json\)/);
});

test('generate_page: the records list\'s files pass validate_page and validate_app, and query_source counts the rows given', async () => {
  const { bad, text } = await call('generate_page', { pattern: 'records-list', id: 'customers', rows: JSON.stringify(ROWS), task: 'triage', writes: true });
  assert.equal(bad, false, text);
  const made = files(text);
  assert.deepEqual(Object.keys(made), ['templates/customers.html', 'view-schemas/customers.json', 'views/customers-views.json']);
  const definition = JSON.parse(made['view-schemas/customers.json']);
  // The data's fields, the pattern's ui and a grid's columns and key from the data.
  assert.deepEqual(Object.keys(definition.source.fields), ['plan', 'owner', 'seats', 'score', 'created']);
  assert.deepEqual(definition.source.search, ['name']);
  assert.equal(definition.ui.grid.key, 'id');
  assert.deepEqual(definition.ui.grid.actions.map((a) => a.id), ['edit', 'delete']);
  // One summary metric per number field, and one input per field a reader writes.
  const html = made['templates/customers.html'];
  assert.equal([...html.matchAll(/<sherpa-metric [^>]*data-aggregate="sum" data-field="(\w+)"/g)].map((m) => m[1]).join(), 'seats,score');
  assert.equal([...html.matchAll(/<sherpa-input-text name="(\w+)"/g)].map((m) => m[1]).join(), 'name,plan,owner,seats,score,created');

  const checked = await call('validate_page', { definition: made['view-schemas/customers.json'], views: made['views/customers-views.json'], template: html });
  assert.match(checked.text, /^## Page "customers": sound/);

  const app = mkdtempSync(join(work, 'made-'));
  writeFileSync(join(app, 'package.json'), '{ "name": "made", "private": true }');
  for (const [path, body] of Object.entries(made)) {
    mkdirSync(dirname(join(app, path)), { recursive: true });
    writeFileSync(join(app, path), body);
  }
  const { contexts } = JSON.parse(text.split('add to its `contexts`\n\n````json\n')[1].split('\n````')[0]);
  writeFileSync(join(app, 'app.json'), JSON.stringify({ v: 1, product: { name: 'Made' }, default: 'customers', contexts }));
  assert.match((await call('validate_app', { path: app })).text, /^## App "Made" \([^)]+\): sound/);

  const run = await call('query_source', { definition: made['view-schemas/customers.json'], rows: ROWS, key: 'id' });
  assert.equal(JSON.parse(run.text.split('```json\n')[1].split('\n```')[0]).total, ROWS.length);
});

test('generate_page: the filter scopes hold their kinds in the View, draw one chart per status field, and take the header\'s bar away', async () => {
  const { bad, text } = await call('generate_page', { pattern: 'filter-scopes', id: 'accounts', rows: ROWS, status: HEALTH });
  assert.equal(bad, false, text);
  const made = files(text);
  const definition = JSON.parse(made['view-schemas/accounts.json']);
  assert.deepEqual(definition.source.scopes.view.holds, ['created', 'health']);
  assert.deepEqual(definition.source.fields.health, { label: 'Health', select: 'multiple' });
  assert.match(made['templates/accounts.html'], /<sherpa-container-header slot="header" data-heading="Health"><\/sherpa-container-header>\n {4}<sherpa-radial-chart data-grow data-segment-field="health">/);
  assert.match(text, /"chrome": \{\n\s+"filters": false\n/);
  assert.match(text, /- \*\*Markup\*\* — check_usage.*: sound/);
});

test('generate_page: a Settings page is its template alone, under settings.pages; data it cannot draw is refused', async () => {
  const { bad, text } = await call('generate_page', { pattern: 'settings-form', id: 'profile', rows: [{ name: 'Will', email: 'w@example.com', bio: '' }] });
  assert.equal(bad, false, text);
  const made = files(text);
  assert.deepEqual(Object.keys(made), ['templates/profile.html']);
  assert.match(made['templates/profile.html'], /<form id="profile-form" novalidate>/);
  assert.match(made['templates/profile.html'], /<sherpa-section-header id="section-profile" data-heading="Details">/);
  assert.match(text, /add to its `settings\.pages`\n\n````json\n\{\n {2}"settings": \{\n {4}"pages": \{\n {6}"profile": \{/);
  assert.match((await call('validate_page', { template: made['templates/profile.html'] })).text, /sound/);
  assert.equal((await call('generate_page', { pattern: 'nope', id: 'x', rows: ROWS })).bad, true);
  assert.match((await call('generate_page', { pattern: 'records-list', id: 'x' })).text, /Give the data as `rows` or as a page's `fields`/);
});

test('describe_data fills the need: status fields from the store\'s, children from the page\'s fields, and neither from a sample', async () => {
  const need = async (args) => {
    const { text } = await call('describe_data', args);
    return JSON.parse(text.split('### The need')[1].split('````json\n')[1].split('\n````')[0]);
  };
  const plain = await need({ rows: JSON.stringify(ROWS), task: 'triage' });
  assert.ok(!('statusFields' in plain) && !('childFields' in plain), 'a sample shows neither, so neither is said');
  const status = await need({ rows: JSON.stringify(ROWS), status: JSON.stringify(HEALTH) });
  assert.equal(status.statusFields, 1);
  assert.equal(status.fields, Object.keys(ROWS[0]).length + 1);
  const page = await need({ fields: JSON.stringify({ customer: { label: 'Customer', select: 'multiple', child: 'site' }, site: { label: 'Site', select: 'multiple' }, seats: { type: 'number' } }) });
  assert.deepEqual(page, { fields: 3, dateFields: 0, numberFields: 1, childFields: 1 });
  for (const n of [status, page]) assert.deepEqual(schemaCheck('pattern.v1.json#/$defs/need')(n), []);
  const wrong = await call('describe_data', { rows: JSON.stringify(ROWS), status: '{"health":{"type":"status"}}' });
  assert.equal(wrong.bad, true);
  assert.match(wrong.text, /status\.health\/ must have required property 'values'/);
});

test('the patterns are resources, as their files hold them, and build_page is the skill the package ships', async () => {
  const listed = JSON.parse((await client.readResource({ uri: 'sherpa://patterns' })).contents[0].text);
  assert.deepEqual(listed.patterns.map((p) => p.id), ['filter-scopes', 'records-list', 'settings-form']);
  for (const id of PATTERNS) assert.equal((await client.readResource({ uri: `sherpa://pattern/${id}` })).contents[0].text, disk(`patterns/${id}.json`));
  await assert.rejects(client.readResource({ uri: 'sherpa://pattern/nope' }), /No such resource/);
  const { messages } = await client.getPrompt({ name: 'build_page', arguments: { task: 'triage' } });
  const said = messages[0].content.text;
  const skill = disk('mcp-server/skills/build-page/SKILL.md');
  assert.ok(said.startsWith('The task: triage.\n\n# Build a page'));
  assert.ok(said.endsWith(skill.slice(skill.indexOf('# Build a page'))));
  for (const step of ['describe_data', 'pick_pattern', 'generate_page', 'validate_page', 'preview_page']) assert.match(said, new RegExp(`\\*\\*\`${step}\`\\*\\*`));
});
