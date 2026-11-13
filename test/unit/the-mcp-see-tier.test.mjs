/**
 * The MCP's see tier over stdio (plan 700 G5): the server started as a client
 * starts it; a grid previewed over sample rows in a headless browser, acted on,
 * read and its trace watched; a usage fault, another host and inline script each
 * held to what the page did; and the preview closed with no server and no browser
 * left. Demos' Records page is previewed read-only where Demos sits beside this
 * checkout, and skipped where it does not. TRAP T-a-preview-is-this-machine-only
 *
 *   node --test test/unit/the-mcp-see-tier.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// A lane run points SHERPA_DEMOS at its own Demos pair; the default is the one beside this checkout.
const DEMOS = `${(process.env.SHERPA_DEMOS ?? `${ROOT}../Sherpa Demos`).replace(/\/$/, '')}/app/`;
// A browser is Playwright's Chromium; with none here, the tests that draw are skipped.
const pw = await import('playwright-core').catch(() => null);
const drawn = await pw?.chromium.launch().then((b) => b.close().then(() => true), () => false);
const skip = drawn ? false : 'no Chromium for Playwright here: `npx playwright install chromium`';
const skipDemos = skip || (existsSync(`${DEMOS}app.json`) ? false : `no ${DEMOS}: Demos' Records page is read where Demos sits beside this checkout`);

const rows = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Person ${i}`, status: ['active', 'trial', 'churned'][i % 3], seats: i * 3 }));
const definition = {
  v: 1, id: 'people',
  source: {
    store: 'people', pageSize: 10,
    fields: { status: { label: 'Status', select: 'multiple' }, seats: { label: 'Seats', type: 'number' } },
    scopes: { data: { label: 'People', holds: ['status'] } },
  },
  ui: { grid: { key: 'id', columns: [{ field: 'name', header: 'Name' }, { field: 'status', header: 'Status' }, { field: 'seats', header: 'Seats', type: 'number' }] } },
};
const template = `<sherpa-container data-padding="none" data-fill>
  <sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>
  <sherpa-pagination id="pager" slot="footer"></sherpa-pagination>
</sherpa-container>`;

const transport = new StdioClientTransport({ command: process.execPath, args: [`${ROOT}mcp-server/index.js`], cwd: ROOT, stderr: 'pipe' });
const client = new Client({ name: 'the-mcp-see-tier', version: '1' });
before(() => client.connect(transport));
after(async () => {
  await client.callTool({ name: 'preview_close', arguments: {} });
  assert.deepEqual(children(), [], 'a browser outlived the tests');
  await client.close();
});

/** A tool's answer: whether it refused, its words, its JSON and its image. */
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content[0].text;
  const at = text.indexOf('```json\n');
  const image = r.content.find((c) => c.type === 'image');
  return {
    bad: !!r.isError, text, json: at < 0 ? null : JSON.parse(text.slice(at + 8, text.lastIndexOf('```'))),
    png: image ? Buffer.from(image.data, 'base64') : null,
  };
}

/** The MCP server's own child processes: the browser, while a preview is open. */
function children() {
  try {
    return execFileSync('pgrep', ['-P', String(transport.pid)], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Whether something listens on a port of this machine. */
const listening = (port) => new Promise((done) => {
  const socket = connect(port, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', () => done(false));
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
let first;

test('preview_page draws a grid over sample rows on this machine: a screenshot, no report, no usage problem', { skip }, async () => {
  const { bad, text, json, png } = await call('preview_page', { definition, template, rows });
  assert.equal(bad, false, text);
  assert.ok(png && png.subarray(0, 4).equals(PNG) && png.length > 10000, `a drawn page, not a blank one: ${png?.length} bytes`);
  assert.deepEqual(json.reports, [], text);
  assert.deepEqual(json.usage, []);
  assert.deepEqual(json.page, { errors: [], failed: [], unread: [] });
  assert.equal(json.loaded, true);
  assert.equal(json.settled, true);
  // The rows came through the Node host's data handler, paged as the definition says.
  assert.deepEqual({ total: json.source.total, rows: json.source.rows, totalPages: json.source.totalPages, reach: json.source.reach }, { total: 30, rows: 10, totalPages: 3, reach: 'ok' });
  assert.equal(json.drawn['sherpa-data-grid'], 1);
  first = new URL(json.url);
  assert.equal(first.hostname, '127.0.0.1');
  assert.ok(![4000, 4200].includes(Number(first.port)), first.port);
  assert.equal(children().length, 1, 'one browser');
});

test('preview_page refuses a type that is none, in its schema\'s words, and the preview open stays open', { skip }, async () => {
  const { bad, text } = await call('preview_page', { definition, template, rows, type: { v: 1 } });
  assert.equal(bad, true);
  assert.match(text, /The type is not one \(type\.v1\)/);
  assert.equal(children().length, 1, 'the first preview\'s browser');
});

test('call_component pages the pager as a reader would; watch_trace says that act by node, the page\'s spans and its host\'s joined', { skip }, async () => {
  const { bad, text, json } = await call('call_component', { selector: '#pager', method: 'goToPage', args: [2], readBack: ['page'] });
  assert.equal(bad, false, text);
  assert.equal(json.readBack.page, 2);
  assert.equal(json.attrs['data-page'], '2');
  assert.deepEqual(json.reports, []);
  const trace = await call('watch_trace', {});
  assert.match(trace.json.preview.act, /goToPage/);
  const node = (id) => trace.json.preview.nodes.find((n) => n.node === id)?.steps ?? [];
  assert.deepEqual(node('source').filter((s) => s.step === 'load').map((s) => [s.step, s.state, s.rows, s.total]), [['load', 'done', 10, 30]]);
  // The page asked its store, and the Node host answered under the same trace: the Source's reads (TODO 808).
  const store = node('source').map((s) => `${s.step} ${s.host} ${s.state}`);
  assert.ok(store.includes('request page done') && store.includes('answer server done'), store.join('; '));
  assert.deepEqual(node('presentation-data').map((s) => s.state), ['done']);
});

test('read_component reads the grid as it stands: its attributes, its columns, its parts', { skip }, async () => {
  const { bad, text, json } = await call('read_component', { selector: '#grid' });
  assert.equal(bad, false, text);
  assert.equal(json.tag, 'sherpa-data-grid');
  assert.equal(json.attrs['data-scope'], 'data');
  assert.deepEqual(json.values.columns.map((c) => c.field), ['name', 'status', 'seats']);
  assert.ok(json.parts.some((p) => p.part === 'body' && p.shown), JSON.stringify(json.parts));
  // Only a method the spec lists is called, and only on a component.
  const unlisted = await call('call_component', { selector: '#grid', method: 'remove' });
  assert.equal(unlisted.bad, true);
  assert.match(unlisted.text, /lists no method "remove". It lists: .*clearSelection/);
  const native = await call('call_component', { selector: 'sherpa-app-shell', method: 'click' });
  assert.equal(native.bad, true);
  assert.equal((await call('call_component', { selector: 'body', method: 'remove' })).text, '"body" is a <body>, which is no Sherpa component: only a component\'s listed methods are called.');
  assert.match((await call('read_component', { selector: '#nothing-here' })).text, /No element matches "#nothing-here"/);
});

test('a usage fault is that problem, in check_usage\'s words; a second preview closes the first', { skip }, async () => {
  const faulty = `${template}\n<sherpa-button data-size="huge" data-label="Go"></sherpa-button>`;
  const { bad, json } = await call('preview_page', { definition, template: faulty, rows });
  assert.equal(bad, false);
  const own = await call('check_usage', { markup: faulty, name: 'template' });
  assert.equal(json.usage.length, 1);
  assert.ok(own.text.includes(json.usage[0]), `${json.usage[0]} — not in: ${own.text}`);
  assert.match(json.usage[0], /data-size.*huge/);
  assert.equal(await listening(Number(first.port)), false, 'the first preview\'s server still listens');
  assert.equal(children().length, 1, 'one browser, not two');
});

test('the page asks nothing of another host, runs no inline script, and no page but this machine\'s is opened', { skip }, async () => {
  const markup = '<img id="far" src="https://example.com/pixel.png" alt=""><img id="near" src="/nope.png" alt="" onerror="this.setAttribute(\'data-ran\', \'\')">';
  const { json } = await call('preview_page', { template: markup });
  assert.ok(json.page.failed.some((f) => /https:\/\/example\.com\/pixel\.png .*not this machine: refused/.test(f)), JSON.stringify(json.page));
  assert.ok(json.page.failed.some((f) => /^GET \/nope\.png — 404$/.test(f)), JSON.stringify(json.page));
  // The image failed, and its handler did not run: the CSP refused it.
  const near = await call('read_component', { selector: '#near' });
  assert.equal(near.json.attrs['data-ran'], undefined);
  assert.ok(json.page.errors.some((e) => /Content Security Policy/.test(e)), JSON.stringify(json.page.errors));
  for (const url of ['https://example.com/', 'http://localhost.example.com:4200/', 'http://10.0.0.1/', 'file:///etc/passwd']) {
    for (const name of ['call_component', 'read_component']) {
      const refused = await call(name, { selector: 'body', method: 'x', url });
      assert.equal(refused.bad, true, `${name} ${url}`);
      assert.match(refused.text, /Only a page on this machine .* nothing was opened/, `${name} ${url}`);
    }
  }
});

test('read_component reads any page on this machine, beside the preview; call_component calls nothing there that is no component', { skip }, async (t) => {
  await call('preview_page', { definition, template, rows });
  const other = createServer((_, res) => res.end('<!doctype html><p id="hello" data-x="1">Hi</p>'));
  await new Promise((up) => other.listen(0, '127.0.0.1', up));
  t.after(() => new Promise((down) => { other.closeAllConnections(); other.close(down); }));
  const url = `http://127.0.0.1:${other.address().port}/`;
  const hello = await call('read_component', { selector: '#hello', url });
  assert.equal(hello.bad, false, hello.text);
  assert.deepEqual([hello.json.tag, hello.json.attrs], ['p', { id: 'hello', 'data-x': '1' }]);
  assert.equal((await call('call_component', { selector: '#hello', method: 'remove', url })).bad, true);
  // With no url, it is the preview's page still.
  const pager = await call('read_component', { selector: '#pager' });
  assert.equal(pager.json.attrs['data-total-pages'], '3');
  assert.equal(children().length, 1, 'one browser for both');
});

test('preview_close leaves no server and no browser', { skip }, async () => {
  const url = new URL((await call('watch_trace', {})).json.preview.url);
  assert.equal(await listening(Number(url.port)), true);
  assert.equal(children().length, 1);
  const { bad, text } = await call('preview_close', {});
  assert.equal(bad, false);
  assert.match(text, /^Closed: http:\/\/127\.0\.0\.1:\d+\/\?context=people and http:\/\/127\.0\.0\.1:\d+\/ — its browser and its server are gone\.$/);
  assert.equal(await listening(Number(url.port)), false, 'its server still listens');
  assert.deepEqual(children(), [], 'its browser still runs');
  assert.equal((await call('preview_close', {})).text, 'No preview was open.');
  assert.match((await call('read_component', { selector: '#grid' })).text, /No preview is open/);
});

test('watch_trace after a query_source act lists its steps by node: the load, the scope and the condition with its rows', async () => {
  const command = { scope: 'data', field: 'status', reading: { picked: ['active'] } };
  const asked = await call('query_source', { definition, rows, key: 'id', commands: [command] });
  assert.equal(asked.bad, false, asked.text);
  const { bad, text, json } = await call('watch_trace', {});
  assert.equal(bad, false, text);
  assert.equal(json.mcp.page, 'people');
  assert.deepEqual(json.mcp.loads.map((l) => l.asked), ['open', command]);
  const node = (id) => json.mcp.loads[1].nodes.find((n) => n.node === id)?.steps ?? [];
  const active = rows.filter((r) => r.status === 'active').length;
  assert.deepEqual(node('source').map((s) => [s.step, s.state, s.total]), [['load', 'done', active]]);
  assert.deepEqual(node('when-data-status').map((s) => [s.state, s.rows]), [['done', active]]);
  assert.deepEqual(node('presentation-data').map((s) => s.state), ['done']);
  assert.match(text, /- `when-data-status` — step \(page\): done, 0 ms, 10 row\(s\)/);
  const one = await call('watch_trace', { node: 'when-data-status' });
  assert.deepEqual(one.json.mcp.loads[1].nodes.map((n) => n.node), ['when-data-status']);
});

test('sherpa-ui-mcp packs the page it serves, and names its browser as a peer it imports only to preview', () => {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: `${ROOT}mcp-server`, encoding: 'utf8' }))[0];
  const files = new Set(packed.files.map((f) => f.path));
  // Served to the page, or read as a prompt, so no import reaches them.
  for (const file of ['preview/index.html', 'preview/page.js', 'preview/walked.js', 'skills/review-page/SKILL.md', 'skills/explain-page/SKILL.md']) {
    assert.ok(files.has(file), file);
  }
  const pkg = JSON.parse(readFileSync(`${ROOT}mcp-server/package.json`, 'utf8'));
  assert.ok(pkg.peerDependencies?.['playwright-core'], 'the browser is a peer');
  assert.equal(pkg.dependencies['playwright-core'], undefined);
  assert.doesNotMatch(readFileSync(`${ROOT}mcp-server/lib/preview.js`, 'utf8'), /^import .*playwright/m, 'imported at start');
});

test('review_page and explain_page are the skills the package ships, after what was asked', async () => {
  for (const [name, skill, args, asked] of [
    ['review_page', 'review-page', { context: 'records', path: 'app' }, 'The Context: records.\nThe app: app.\n'],
    ['explain_page', 'explain-page', { context: 'records', field: 'status' }, 'The Context: records.\nThe app: ..\nThe field to act on: status.\n'],
  ]) {
    const text = (await client.getPrompt({ name, arguments: args })).messages[0].content.text;
    const steps = readFileSync(`${ROOT}mcp-server/skills/${skill}/SKILL.md`, 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '');
    assert.equal(text, `${asked}\n${steps}`, name);
  }
});

/** Rows for every field Demos' Records declares, the same each run; dates counted back from today. */
const STATUS = ['active', 'trial', 'suspended', 'churned'];
const day = (back) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const customers = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1, name: `Person ${i}`, email: `p${i}@example.com`, customer: ['Acme', 'Contoso', 'Globex'][i % 3], site: `Site ${i % 5}`,
  status: STATUS[i % 4], plan: ['Free', 'Starter', 'Pro', 'Enterprise'][(i * 7) % 4], tier: ['Bronze', 'Gold'][i % 2], region: ['EMEA', 'AMER', 'APAC'][i % 3],
  owner: ['Unassigned', 'Ravi Menon'][i % 2], seats: (i * 13) % 200, spend: i * 100, openTickets: i % 5, health: ['Healthy', 'At risk'][i % 2],
  score: 30 + ((i * 17) % 70), created: day(i * 4), lastSeen: day(i),
}));

test('preview_page draws Demos\' Records page from its app.json, read and never written', { skip: skipDemos }, async () => {
  const before = readFileSync(`${DEMOS}templates/records.html`, 'utf8');
  const { bad, text, json, png } = await call('preview_page', { path: `${DEMOS}app.json`, context: 'records', rows: customers });
  assert.equal(bad, false, text);
  assert.equal(json.loaded, true, text);
  assert.ok(png.length > 20000, `${png.length} bytes`);
  assert.ok(json.source.total > 0 && json.source.reach === 'ok', JSON.stringify(json.source));
  assert.ok(json.drawn['sherpa-data-grid'] >= 1, JSON.stringify(json.drawn));
  // Its own hooks come from its sherpa-usage.json, as validate_app reads them.
  assert.deepEqual(json.usage, []);
  assert.equal(readFileSync(`${DEMOS}templates/records.html`, 'utf8'), before);
  await call('preview_close', {});
  assert.deepEqual(children(), []);
});
