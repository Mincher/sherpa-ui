/**
 * THE MCP's DATA TOOLS — validate_page, through a fake server: a page's own
 * saved filters are query definitions (366 S2). One that fills a scope the page
 * does not have is an error; one that is not a name and a query is reported; a
 * field the page does not declare is a note. Needs `npm run build`.
 *
 *   node --test test/unit/the-mcp-data-tools.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../../mcp-server/tools/data.js';

const tools = {};
register({ registerTool: (name, _meta, handler) => { tools[name] = handler; } });

const page = (savedFilters) => ({
  v: 1, id: 'plans',
  source: {
    store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier' } },
    scopes: { view: { holds: ['tier'] }, data: { holds: ['plan'] } },
  },
  savedFilters,
});
const check = async (doc) => {
  const out = await tools.validate_page({ document: JSON.stringify(doc) });
  return { bad: !!out.isError, text: out.content[0].text };
};

test('a page\'s own saved filter, a query definition, is sound', async () => {
  const r = await check(page({ pro: { label: 'Pro', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } }));
  assert.equal(r.bad, false, r.text);
});

test('a saved filter that fills a scope the page does not have is an error', async () => {
  const r = await check(page({ pro: { label: 'Pro', query: { v: 1, scopes: { rows: { where: { plan: { eq: 'Pro' } } } } } } }));
  assert.equal(r.bad, true);
  assert.match(r.text, /fills scope "rows", which source\.scopes does not have/);
});

test('one in the old shape fails the schema and is reported', async () => {
  const r = await check(page({ old: { label: 'Old', where: { plan: { eq: 'Pro' } } } }));
  assert.equal(r.bad, true);
  assert.match(r.text, /is not \{ label, query: \{ v: 1, scopes \} \}/);
});

test('a field the page does not declare is a note, not an error', async () => {
  const r = await check(page({ busy: { label: 'Busy', query: { v: 1, scopes: { data: { where: { tickets: { gt: 0 } } } } } } }));
  assert.equal(r.bad, false, r.text);
  assert.match(r.text, /saved filter "busy" names "tickets", which source\.fields does not declare/);
});
