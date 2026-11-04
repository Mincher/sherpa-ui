/**
 * The MCP's read tier over stdio (plan 700 G1): the server started as a client
 * starts it, every tool called, every resource read, and what the answers hold —
 * a file as on disk, G0's asks, takes, presents and settings, and no Figma.
 *
 *   node --test test/unit/the-mcp-read-tier.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SAMPLES, callEverything } from '../../scripts/check-mcp-pack.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const disk = (path) => readFileSync(`${ROOT}${path}`, 'utf8');
const client = new Client({ name: 'the-mcp-read-tier', version: '1' });

before(() => client.connect(new StdioClientTransport({
  command: process.execPath, args: [`${ROOT}mcp-server/index.js`], cwd: ROOT, stderr: 'pipe',
})));
after(() => client.close());

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { bad: !!r.isError, text: r.content[0].text };
};
const resource = async (uri) => (await client.readResource({ uri })).contents[0].text;

test('every tool answers, and every resource it lists is read', async () => {
  // In a checkout, an app the repo holds; installed, the Starter's.
  const { tools, resources, failures } = await callEverything(client, { ...SAMPLES, validate_app: { path: 'test/reforged/outlet' } });
  // scaffold_app serves the Starter, a sibling project; where it is not, it says so.
  const starter = existsSync(`${ROOT}../Sherpa Starter/index.mjs`);
  assert.deepEqual(failures.filter((f) => starter || !f.startsWith('scaffold_app: create-sherpa-ui is not here')), []);
  assert.ok(tools >= 3);
  // Specs, examples and sources for every component, the schemas and three docs.
  assert.ok(resources > 300, `${resources} resources`);
});

test('list_components names every element the package defines, with what it asks for and draws', async () => {
  const { text } = await call('list_components', {});
  for (const m of JSON.parse(disk('custom-elements.json')).modules) {
    assert.match(text, new RegExp(`\\*\\*${m.declarations[0].tagName}\\*\\*`));
  }
  assert.match(text, /\*\*sherpa-data-grid\*\* .*\n {2}.*asks \{"shape":"rows","filters":true,"fields":true\} · takes highlight · presents grid/);
  assert.doesNotMatch(text, /Figma:/);
  const charts = await call('list_components', { category: 'chart' });
  assert.match(charts.text, /^6 component\(s\) in chart/);
  assert.equal((await call('list_components', { category: 'nope' })).bad, true);
});

test('get_component gives a spec\'s contract in its own keys, its example and its import, and no Figma', async () => {
  const { bad, text } = await call('get_component', { name: 'sherpa-data-grid' });
  assert.equal(bad, false);
  assert.match(text, /- Import: `import 'sherpa-ui\/components\/data-grid';`/);
  assert.match(text, /## Example\n\nWhen to use it: /);
  const spec = JSON.parse(disk('src/components/sherpa-data-grid/sherpa-data-grid.component.json'));
  const contract = JSON.parse(text.slice(text.lastIndexOf('```json') + 7, text.lastIndexOf('```')));
  for (const key of ['props', 'slots', 'events', 'asks', 'takes', 'presents', 'settings']) assert.deepEqual(contract[key], spec[key], key);
  assert.deepEqual(contract.$extensions.sherpa.methods, spec.$extensions.sherpa.methods);
  assert.deepEqual(Object.keys(contract.$extensions.sherpa).sort(), ['jsProps', 'methods']);
  // Each key in the component schema's own words.
  const schema = JSON.parse(disk('schemas/component.v1.json'));
  assert.ok(text.includes(`- \`asks\` — ${schema.properties.asks.description}`));
  assert.doesNotMatch(text, /figmaName|figmaNodeId|variantAxes|booleanProps/);
});

test('get_component says what each slot accepts, and the commands a button can send', async () => {
  // TRAP T-a-slot-says-what-it-accepts
  const dialog = JSON.parse((await call('get_component', { name: 'sherpa-dialog' })).text.split('```json').at(-1).split('```')[0]);
  assert.ok(dialog.slots.length && dialog.slots.every((s) => s.accepts?.length), 'every slot says what it accepts');
  assert.ok(dialog.$extensions.sherpa.commands.some((c) => c.name === '--show'));
});

test('get_component with include spec is the spec as on disk; a name that is none is refused', async () => {
  const { text } = await call('get_component', { name: 'sherpa-button', include: 'spec' });
  assert.equal(text, disk('src/components/sherpa-button/sherpa-button.component.json'));
  const nope = await call('get_component', { name: 'sherpa-nope' });
  assert.equal(nope.bad, true);
  assert.match(nope.text, /No component "sherpa-nope"\. The components: sherpa-accordion, /);
});

test('find_token finds names by every word, and a common word finds its token\'s', async () => {
  const surface = await call('find_token', { query: 'surface' });
  assert.match(surface.text, /^\d+ token\(s\) match "surface"/);
  assert.match(surface.text, /- `--sherpa-[\w-]*surface[\w-]*`: `[^`]+`/);
  const bg = await call('find_token', { query: 'bg' });
  assert.match(bg.text, /surface/);
  const two = await call('find_token', { query: 'border accent' });
  const listed = [...two.text.matchAll(/^- `(--sherpa-[\w-]+)`/gm)].map((m) => m[1]);
  assert.ok(listed.length);
  for (const name of listed) assert.match(name, /border.*accent|accent.*border/);
  assert.match((await call('find_token', { query: '' })).text, /^tokens\.css declares \d+ tokens/);
  assert.match((await call('find_token', { query: 'zzz' })).text, /^No token name holds "zzz"/);
});

test('a resource is sherpa-ui\'s own file, as it ships, never a copy', async () => {
  assert.equal(await resource('sherpa://spec/sherpa-data-grid'), disk('src/components/sherpa-data-grid/sherpa-data-grid.component.json'));
  assert.equal(await resource('sherpa://example/sherpa-button'), disk('src/components/sherpa-button/sherpa-button.example.json'));
  assert.equal(await resource('sherpa://component/sherpa-button/css'), disk('src/components/sherpa-button/sherpa-button.css'));
  assert.equal(await resource('sherpa://schemas/page'), disk('schemas/page.v1.json'));
  assert.equal(await resource('sherpa://schemas/defs'), disk('schemas/defs.v1.json'));
  assert.equal(await resource('sherpa://app-guide'), disk('docs/APP-GUIDE.md'));
  assert.equal(await resource('sherpa://data-rules'), disk('docs/DATA-SOURCE-RULES.md'));
  assert.equal(await resource('sherpa://tokens'), disk('src/styles/tokens/tokens.css'));
});

test('a name that is no file, or a way out of the package, is refused', async () => {
  for (const uri of ['sherpa://spec/sherpa-nope', 'sherpa://spec/..%2Fpackage', 'sherpa://component/sherpa-button/json', 'sherpa://schemas/nope']) {
    await assert.rejects(resource(uri), /No such resource/, uri);
  }
  const { resources } = await client.listResources();
  assert.ok(!resources.some((r) => r.uri === 'sherpa://rules' || r.uri.startsWith('sherpa://def/')), 'the build rules and the def form are not served');
});
