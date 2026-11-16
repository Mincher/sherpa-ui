import { test, expect, type Page } from './harness';

/**
 * THE AGENT-TOOLS DOOR — plan 1008 G1 (1008c1): the tools an agent works an app with, over its outlet's own doors, each
 * said once. The read tools here: what the app holds, what is on screen, a page described and its rows read and summed
 * without opening it, the node kinds, and the rules. A read is quiet: the page on screen stays.
 */
type Answer = { ok: boolean; data: unknown };

/** The typed test app, open on its Devices page, and its agent's tools on `window.agent`. */
async function open(page: Page, asks = false): Promise<void> {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(async (asks) => {
    const { SessionStore, agentTools } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as HTMLElement & { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    const grid = () => document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot };
    for (let i = 0; i < 100 && !grid()?.shadowRoot?.querySelectorAll('.row').length; i++) await new Promise((done) => setTimeout(done, 50));
    // The app's own asking, a chat's as it were: what it was asked, the reader's answers, and each change it was told.
    const w = window as unknown as { agent: unknown; asked: string[]; allow: boolean; answers: Record<string, unknown>; changes: { label: string; undo(): Promise<unknown>; route: unknown }[] };
    Object.assign(w, { asked: [], allow: true, answers: {}, changes: [] });
    w.agent = agentTools(outlet as never, {
      rules: 'APP WORDS FIRST.', onScreen: () => ({ tab: 'overview' }),
      ...(asks ? {
        ask: async (words: string) => { w.asked.push(words); return w.allow; },
        step: async (step: { field: string }) => w.answers[step.field],
        onChange: (change: { label: string; undo(): Promise<unknown>; route: unknown }) => w.changes.push(change),
      } : {}),
    });
  }, asks);
}
const run = (page: Page, name: string, input: Record<string, unknown> = {}) => page.evaluate(([n, i]) =>
  (window as unknown as { agent: { run(n: string, i: unknown): Promise<Answer> } }).agent.run(n as string, i), [name, input] as const) as Promise<Answer>;

test('the tools are said once, their `context` naming the app\'s Contexts; a tool there is not is refused', async ({ page }) => {
  await open(page);
  const tools = await page.evaluate(() => (window as unknown as { agent: { tools: { name: string; input: { properties: Record<string, { enum?: string[] }> } }[] } }).agent.tools);
  expect(tools.map((t) => t.name)).toEqual(['get_app', 'on_screen', 'describe_page', 'read_rows', 'summarize', 'open_page', 'filter', 'use_preset', 'arrange', 'clear_filters', 'node_kinds']);
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

/** The Devices grid's rows as they read now. */
const gridRows = (page: Page) => page.evaluate(() => [...(document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot.querySelectorAll('.row')]
  .map((row) => (row as HTMLElement).innerText.replace(/\s+/g, ' ').trim().split(' ')[0]));

test('filter, arrange and clear_filters change what the page on screen shows, through its Query; a field it has not is refused (1008c2)', async ({ page }) => {
  await open(page);
  const filtered = await run(page, 'filter', { where: { status: { eq: 'online' } } }) as { ok: boolean; data: { total: number } };
  expect(filtered.ok).toBe(true);
  expect(filtered.data.total).toBe(2);
  await expect.poll(() => gridRows(page)).toEqual(['Alpha', 'Charlie']);
  const sorted = await run(page, 'arrange', { sort: 'risk', direction: 'asc' }) as { ok: boolean; data: { total: number } };
  expect(sorted.data.total).toBe(2);
  await expect.poll(() => gridRows(page)).toEqual(['Charlie', 'Alpha']);
  expect(await run(page, 'arrange', {})).toEqual({ ok: false, data: 'Name a sort, a group or a search.' });
  expect(await run(page, 'filter', { where: { colour: { eq: 'red' } } })).toEqual({ ok: false, data: 'The Devices page has no field colour. Call describe_page.' });
  const cleared = await run(page, 'clear_filters') as { ok: boolean; data: { total: number } };
  expect(cleared.data.total).toBe(3);
  await expect.poll(() => gridRows(page)).toHaveLength(3);
  expect(await run(page, 'use_preset', { id: 'nope' })).toEqual({ ok: false, data: 'This page has no preset or Filter nope. Call describe_page.' });
});

test('open_page takes the reader to a page, and refuses a page or a View there is not (1008c2)', async ({ page }) => {
  await open(page);
  expect(await run(page, 'open_page', { context: 'nowhere' })).toEqual({ ok: false, data: 'No page is called nowhere. get_app lists them.' });
  const noView = await run(page, 'open_page', { context: 'teammates', view: 'nope' });
  expect(noView.ok).toBe(false);
  expect(await run(page, 'open_page', { context: 'teammates' })).toEqual({ ok: true, data: { context: 'teammates', view: null } });
  expect(await page.evaluate(() => new URL(location.href).searchParams.get('context'))).toBe('teammates');
});

/** The devices store's rows, by id: their status. */
const statuses = (page: Page) => page.evaluate(async () => {
  const outlet = document.querySelector('sherpa-outlet') as unknown as { actContext(): { stores: Record<string, never> } };
  const { storeOfType } = await import('/dist/index.js');
  const rows = (await storeOfType(outlet.actContext().stores, 'device')!.load({})).rows;
  return Object.fromEntries(rows.map((r) => [String(r['id']), String(r['status'])]));
});

test('act and flow are offered only where the app asks the reader; a change is asked first, told to the app, and its Undo puts it back (1008c3)', async ({ page }) => {
  await open(page);
  const quiet = await page.evaluate(() => (window as unknown as { agent: { tools: { name: string }[] } }).agent.tools.map((t) => t.name));
  expect(quiet).not.toContain('act');
  expect(await run(page, 'act', { id: 'device.change' })).toEqual({ ok: false, data: 'No tool is called act.' });

  await open(page, true);
  expect(await page.evaluate(() => (window as unknown as { agent: { tools: { name: string }[] } }).agent.tools.map((t) => t.name))).toEqual(expect.arrayContaining(['act', 'flow']));
  // Declined: nothing changes, and the agent is told not to try another way.
  await page.evaluate(() => { (window as unknown as { allow: boolean }).allow = false; });
  const no = await run(page, 'act', { id: 'device.change', keys: ['d2'], input: { status: 'online' } });
  expect(no.ok).toBe(false);
  expect((await statuses(page))['d2']).toBe('offline');
  // Allowed: asked in the act's words, done, and told to the app with its Undo.
  await page.evaluate(() => { (window as unknown as { allow: boolean }).allow = true; });
  const yes = await run(page, 'act', { id: 'device.change', keys: ['d2'], input: { status: 'online' } });
  expect(yes.ok).toBe(true);
  expect((await statuses(page))['d2']).toBe('online');
  const told = await page.evaluate(() => { const w = window as unknown as { asked: string[]; changes: { label: string }[] }; return { asked: w.asked.at(-1), labels: w.changes.map((c) => c.label) }; });
  expect(told.asked).toMatch(/"Bravo".*Status online\?$/);
  expect(told.labels).toHaveLength(1);
  await page.evaluate(() => (window as unknown as { changes: { undo(): Promise<unknown> }[] }).changes[0]!.undo());
  expect((await statuses(page))['d2']).toBe('offline');
  expect(await run(page, 'act', { id: 'nothing' })).toEqual({ ok: false, data: 'No act has the id nothing. get_app lists the acts.' });
});

test('flow asks each field it still needs where the app asks, then the confirm, then does the act (1008c3)', async ({ page }) => {
  await open(page, true);
  await page.evaluate(() => { (window as unknown as { answers: Record<string, unknown> }).answers = { id: 'd4', name: 'Delta', status: 'online', risk: 5 }; });
  const added = await run(page, 'flow', { act: 'device.add', input: { name: 'Delta' } });
  expect(added.ok).toBe(true);
  expect((await statuses(page))['d4']).toBe('online');
  // A stopped step stops the flow.
  await page.evaluate(() => { (window as unknown as { answers: Record<string, unknown> }).answers = {}; });
  expect(await run(page, 'flow', { act: 'device.add' })).toEqual({ ok: false, data: 'The reader stopped it. Ask them what they want.' });
});
