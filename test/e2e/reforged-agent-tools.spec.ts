import { test, expect, type Page } from './harness';

/**
 * THE AGENT-TOOLS DOOR — plan 1008 G1 (1008c1): the tools an agent works an app with, over its outlet's own doors, each
 * said once. The read tools here: what the app holds, what is on screen, a page described and its rows read and summed
 * without opening it, the node kinds, and the rules. A read is quiet: the page on screen stays.
 */
type Answer = { ok: boolean; data: unknown };

/** The typed test app, open on its Devices page, and its agent's tools on `window.agent`. */
async function open(page: Page): Promise<void> {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(async () => {
    const { SessionStore, agentTools } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as HTMLElement & { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    const grid = () => document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot };
    for (let i = 0; i < 100 && !grid()?.shadowRoot?.querySelectorAll('.row').length; i++) await new Promise((done) => setTimeout(done, 50));
    (window as unknown as { agent: unknown }).agent = agentTools(outlet as never, { rules: 'APP WORDS FIRST.', onScreen: () => ({ tab: 'overview' }) });
  });
}
const run = (page: Page, name: string, input: Record<string, unknown> = {}) => page.evaluate(([n, i]) =>
  (window as unknown as { agent: { run(n: string, i: unknown): Promise<Answer> } }).agent.run(n as string, i), [name, input] as const) as Promise<Answer>;

test('the tools are said once, their `context` naming the app\'s Contexts; a tool there is not is refused', async ({ page }) => {
  await open(page);
  const tools = await page.evaluate(() => (window as unknown as { agent: { tools: { name: string; input: { properties: Record<string, { enum?: string[] }> } }[] } }).agent.tools);
  expect(tools.map((t) => t.name)).toEqual(['get_app', 'on_screen', 'describe_page', 'read_rows', 'summarize', 'node_kinds']);
  expect(tools.find((t) => t.name === 'read_rows')!.input.properties['context']!.enum).toEqual(['devices', 'teammates', 'all-devices', 'all-teammates']);
  expect(await run(page, 'nope')).toEqual({ ok: false, data: 'No tool is called nope.' });
});

test('get_app: the Contexts, which hold records, what is on screen, and every act with its input', async ({ page }) => {
  await open(page);
  const { ok, data } = await run(page, 'get_app') as { ok: boolean; data: { contexts: { id: string; records: boolean }[]; now: { context: string }; acts: { id: string; input: { type?: string } }[] } };
  expect(ok).toBe(true);
  expect(data.contexts.map((c) => [c.id, c.records])).toEqual([['devices', true], ['teammates', true], ['all-devices', true], ['all-teammates', true]]);
  expect(data.now.context).toBe('devices');
  // Each act's input is its schema, awaited: never an empty object.
  const add = data.acts.find((a) => a.id === 'device.add');
  expect(add?.input.type).toBe('object');
});

test('describe_page and read_rows read a page not on screen, quietly: its fields, values and key; rows narrowed, sorted, trimmed', async ({ page }) => {
  await open(page);
  const about = await run(page, 'describe_page', { context: 'all-devices' }) as { ok: boolean; data: { onScreen: boolean; key: string; total: number; fields: { name: string; label: string; values: unknown[] }[] } };
  expect(about.ok).toBe(true);
  expect({ onScreen: about.data.onScreen, key: about.data.key, total: about.data.total }).toEqual({ onScreen: false, key: 'id', total: 3 });
  expect(about.data.fields.find((f) => f.name === 'status')).toMatchObject({ label: 'Status', values: ['online', 'offline'] });
  const read = await run(page, 'read_rows', { context: 'all-devices', where: { status: { eq: 'online' } }, sort: 'risk', direction: 'desc', fields: ['name', 'risk'] });
  expect(read).toEqual({ ok: true, data: { context: 'all-devices', matched: 2, offset: 0, rows: [{ name: 'Alpha', risk: 80 }, { name: 'Charlie', risk: 40 }] } });
  // A field the page has not is refused, in words.
  expect(await run(page, 'read_rows', { context: 'all-devices', fields: ['colour'] })).toEqual({ ok: false, data: 'The All devices page has no field colour. Call describe_page.' });
  // The page on screen stayed.
  expect(await page.evaluate(() => (document.querySelector('sherpa-outlet') as unknown as { context: string }).context)).toBe('devices');
});

test('summarize: each value\'s rows and sums, largest first; the page on screen read through its own source', async ({ page }) => {
  await open(page);
  expect(await run(page, 'summarize', { context: 'all-devices', by: 'status', sum: ['risk'] })).toEqual({ ok: true, data: {
    context: 'all-devices', matched: 3,
    groups: [{ value: 'online', rows: 2, sums: { risk: 120 } }, { value: 'offline', rows: 1, sums: { risk: 10 } }],
  } });
  const here = await run(page, 'describe_page') as { ok: boolean; data: { context: string; onScreen: boolean; total: number } };
  expect(here.data).toMatchObject({ context: 'devices', onScreen: true, total: 3 });
});

test('on_screen says the page, its acts and what the app adds; node_kinds and the rules come from the library', async ({ page }) => {
  await open(page);
  const seen = await run(page, 'on_screen') as { ok: boolean; data: { context: string; label: string; acts: string[]; tab: string; open: unknown[] } };
  expect(seen.data).toMatchObject({ context: 'devices', label: 'Devices', tab: 'overview', open: [] });
  const kinds = await run(page, 'node_kinds') as { ok: boolean; data: { kind: string }[] };
  expect(kinds.data.some((k) => k.kind === 'source')).toBe(true);
  const one = await run(page, 'node_kinds', { kinds: ['source', 'nothing'] }) as { ok: boolean; data: Record<string, unknown> };
  expect(one.data['nothing']).toBe('no such kind');
  expect(typeof (one.data['source'] as { rows?: unknown }).rows).not.toBe('undefined');
  const rules = await page.evaluate(() => (window as unknown as { agent: { rules(): Promise<string> } }).agent.rules());
  expect(rules.startsWith('APP WORDS FIRST.\n')).toBe(true);
  expect(rules).toContain('#start');
});
