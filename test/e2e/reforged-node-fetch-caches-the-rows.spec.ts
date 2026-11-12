import { test, expect, type Page } from './harness';

/**
 * FETCH reads each Source on a path ONCE, at the press, and caches the rows (the device's `sets` for a remote store);
 * SIMULATE runs the graph on them with no read, and each node's Data pane shows what it heard and said — Will, TODO 836
 * (plan-836 P3, P4). Nothing fetches on its own: not on open, not on an edit, not on Simulate. A fetch stops at the cap and
 * says PARTIAL. Real pointer and keys; the loads are counted on the store. TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 * · TRAP T-a-task-queue-knows-nothing-of-what-it-runs
 */
type Sim = { result: { nodes: Record<string, { incoming: Slot[]; outgoing: Slot[] }>; faults: string[] }; stale: boolean };
type Slot = { socket: string; label: string; kind: string; rows?: { id: number; status: string }[]; value?: unknown; note?: string };
type Ed = { simulation(): Sim | undefined; fetch(): Promise<void>; simulate(): Promise<void> };

const STATES = ['active', 'trial', 'suspended', 'churned'];
const ROWS = Array.from({ length: 120 }, (_, id) => ({ id, status: STATES[(id * 7) % 4] }));
const ACTIVE = ROWS.filter((r) => r.status === 'active');

async function start(page: Page, options: { limit?: { rows?: number }; delay?: number; collect?: boolean; known?: boolean; big?: number; calc?: boolean; count?: boolean } = {}): Promise<void> {
  await page.evaluate(async ([given, limit, delay, collect, known, big, calc, count]) => {
    const rows = big ? Array.from({ length: big }, (_, id) => ({ id, status: ['active', 'trial', 'suspended', 'churned'][(id * 7) % 4]!, seats: id % 100 })) : given;
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { ArrayStore, fakeRemote, TaskQueue } = await import('/dist/data.js');
    const notices: { words: string; status: string }[] = [];
    Object.assign(window, { notices });
    const real = new ArrayStore(rows);
    const store = fakeRemote(real, { delay });
    let loads = 0;
    const load = store.load.bind(store);
    store.load = (o) => { loads++; return load(o); };
    Object.assign(window, { loads: () => loads, store });
    const nodes: { id: string; kind: string; x: number; y: number; heading: string; values?: Record<string, unknown> }[] = [
      { id: 's', kind: 'source', x: 0, y: 0, heading: 's', values: { store: 'users' } }, { id: 'f', kind: 'field', x: 360, y: 0, heading: 'f', values: { field: 'status' } },
      { id: 'c', kind: 'condition', x: 720, y: 0, heading: 'c', values: { type: 'eq', b: 'active' } }, { id: 'o', kind: 'result', x: 1080, y: 0, heading: 'o' },
    ];
    const connections = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/rows', to: 'o' }];
    // A Value into a Math, off the path: a node that sends a number, not rows (P6).
    if (calc) {
      nodes.push({ id: 'v', kind: 'value', x: 0, y: 300, heading: 'v', values: { type: 'integer', value: '21' } }, { id: 'm', kind: 'math', x: 360, y: 300, heading: 'm', values: { type: 'multiply', b: 2 } });
      connections.push({ from: 'v/value', to: 'm/a' });
    }
    // A Math Count of the Source's rows, and one of the Condition's Results: counting is a Math type (plan 944).
    if (count) {
      nodes.push({ id: 'ns', kind: 'math', x: 360, y: 300, heading: 'ns', values: { type: 'count' } }, { id: 'nc', kind: 'math', x: 1080, y: 300, heading: 'nc', values: { type: 'count' } });
      connections.push({ from: 's/rows', to: 'ns/rows' }, { from: 'c/rows', to: 'nc/rows' });
    }
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, { v: 3, id: 'w', nodes, connections } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!,
      stores: ['users'], storeOf: (id: string) => (known && id === 'users' ? store : undefined), tasks: new TaskQueue({ wait: 40 }), ...(limit ? { fetchLimit: limit } : {}),
      ...(collect ? { notify: (words: string, status: string) => notices.push({ words, status }) } : {}),
    });
    await window.__settled();
    canvas.zoomTo(0.4);
    canvas.panTo(20, 68); // below the stage strip
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [ROWS, options.limit ?? null, options.delay ?? 5, options.collect ?? true, options.known ?? true, options.big ?? 0, options.calc ?? false, options.count ?? false] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const tool = (page: Page, name: string) => page.locator(`sherpa-node-toolbar sherpa-button.${name}`);
const loads = (page: Page) => page.evaluate(() => (window as never as { loads(): number }).loads());
const sim = (page: Page) => page.evaluate(() => {
  const s = (window as never as { ed: Ed }).ed.simulation();
  return s ? { stale: s.stale, faults: s.result.faults, nodes: s.result.nodes } : undefined;
});
const out = (s: NonNullable<Awaited<ReturnType<typeof sim>>>, id: string, socket: string) => s.nodes[id]!.outgoing.find((x) => x.socket === socket)!;
const into = (s: NonNullable<Awaited<ReturnType<typeof sim>>>, id: string, socket: string) => s.nodes[id]!.incoming.find((x) => x.socket === socket)!;
/** The device's kept set for a store, as written to IndexedDB. */
const kept = (page: Page) => page.evaluate(() => new Promise<{ rows: unknown[]; total?: number } | null>((done) => {
  const open = indexedDB.open('sherpa-ui');
  open.onerror = () => done(null);
  open.onsuccess = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('sets')) return done(null);
    const get = db.transaction('sets').objectStore('sets').get('source:users');
    get.onsuccess = () => done(get.result ?? null);
    get.onerror = () => done(null);
  };
}));
const notices = (page: Page) => page.evaluate(() => (window as never as { notices: { words: string; status: string }[] }).notices);
const press = (page: Page, name: string) => tool(page, name).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());

test('nothing is read until Fetch is pressed: Simulate says "not fetched yet"; Fetch reads the store once and the graph runs on its rows', async ({ page }) => {
  await start(page);
  expect(await loads(page)).toBe(0);
  expect(await sim(page)).toBeUndefined();
  await press(page, 'play');
  await expect.poll(() => sim(page)).toBeDefined();
  let s = (await sim(page))!;
  expect(out(s, 's', 's/rows').note).toBe('Not fetched yet');
  expect(s.faults).toContain('"s" is not fetched yet');
  expect(await loads(page)).toBe(0);
  await expect(tool(page, 'fetch')).toHaveAttribute('data-tip', 'Fetch data');
  await press(page, 'fetch');
  await expect.poll(async () => (await sim(page))?.faults.length).toBe(0);
  s = (await sim(page))!;
  expect(await loads(page)).toBe(1);
  expect(out(s, 's', 's/rows').rows).toHaveLength(120);
  expect(into(s, 'o', 'o').rows).toEqual(ACTIVE);
  expect(await page.locator('sherpa-node-toolbar').getAttribute('data-cached')).toBe('');
  await expect(tool(page, 'fetch')).toHaveAttribute('data-tip', /^Refetch/);
  // The rows are on the device, for the next tab.
  const record = await kept(page);
  expect(record?.rows).toHaveLength(120);
  expect(record?.total).toBeUndefined();
});

test('a Math Count is the row count: of the Source\'s rows, and of those the Condition kept; its True is 1 (plan 944)', async ({ page }) => {
  await start(page, { count: true });
  await press(page, 'fetch');
  await expect.poll(async () => (await sim(page))?.nodes['nc'] !== undefined).toBe(true);
  const s = (await sim(page))!;
  expect(out(s, 'ns', 'ns/result').value).toBe(120);
  expect(out(s, 'nc', 'nc/result').value).toBe(ACTIVE.length);
  expect(out(s, 'c', 'c/true').value).toBe(1);
  // No node has a Count property, nor a True or a False socket.
  expect(Object.values(s.nodes).flatMap((n) => n.outgoing.map((x) => x.socket)).filter((x) => /\/(count|#false)$/.test(x) || x === 'c')).toEqual([]);
});

test('an edit and Simulate read no more: the last simulation is stale after the edit, and the store is read once', async ({ page }) => {
  await start(page);
  await press(page, 'fetch');
  await expect.poll(() => sim(page)).toBeDefined();
  await page.locator('#cv > sherpa-node[data-heading="c"] sherpa-input-text[name="type"] select').selectOption('ne');
  await settle(page);
  expect((await sim(page))!.stale).toBe(true);
  expect(into((await sim(page))!, 'o', 'o').rows).toEqual(ACTIVE);
  await press(page, 'play');
  await expect.poll(async () => (await sim(page))?.stale).toBe(false);
  expect(into((await sim(page))!, 'o', 'o').rows).toEqual(ROWS.filter((r) => r.status !== 'active'));
  expect(await loads(page)).toBe(1);
  // Fetch again is Refetch: one more read, and the same rows.
  await press(page, 'fetch');
  await expect.poll(() => loads(page)).toBe(2);
});

test('Fetch is a task: both tools wait while it runs and its button says busy; a press by the keys is blocked and said; ONE notice ends it', async ({ page }) => {
  await start(page, { delay: 500 });
  await press(page, 'fetch');
  await expect(page.locator('sherpa-node-toolbar')).toHaveAttribute('data-fetching', '');
  await expect(tool(page, 'fetch')).toHaveAttribute('aria-busy', 'true');
  await expect(tool(page, 'fetch')).toHaveAttribute('data-tip', 'Fetching…');
  for (const name of ['fetch', 'play']) await expect(tool(page, name)).toHaveAttribute('disabled', '');
  // The keys still ask, and the queue says what is in the way, for each.
  await page.locator('#cv').evaluate((cv) => (cv.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.press('ControlOrMeta+Shift+Enter');
  await page.keyboard.press('ControlOrMeta+Enter');
  expect((await notices(page)).map((n) => n.words)).toEqual(['Fetch is still running: wait for it to end.', 'Fetch is still running: wait for it to end.']);
  expect(await loads(page)).toBeLessThanOrEqual(1);
  await expect.poll(() => sim(page)).toBeDefined();
  await expect(tool(page, 'fetch')).toHaveAttribute('aria-busy', 'false');
  await expect(tool(page, 'fetch')).not.toHaveAttribute('disabled', '');
  await expect(page.locator('sherpa-node-toolbar')).not.toHaveAttribute('data-fetching', '');
  // The end: one notice, how it went.
  await expect.poll(async () => (await notices(page)).length).toBe(3);
  expect(await loads(page)).toBe(1);
  expect((await notices(page))[2]).toEqual({ words: 'Fetched. users: 120 rows.', status: 'success' });
  expect(await kept(page)).toMatchObject({ rows: expect.any(Array) });
});

test('a Source being fetched wears the tab on its top edge, right-aligned, with the play icon and "Fetching… 1s", and the active border; it is gone when the fetch ends', async ({ page }) => {
  // 3.4s: each second's words show a whole second, the last 1.4s, so a busy machine still reads them.
  await start(page, { delay: 3400 });
  const source = page.locator('#cv > sherpa-node[data-heading="s"]');
  const idle = page.locator('#cv > sherpa-node[data-heading="f"]');
  const look = (n: ReturnType<Page['locator']>) => n.evaluate((el) => {
    const root = el.shadowRoot!.querySelector('.root') as HTMLElement;
    const tab = el.shadowRoot!.querySelector('.caption') as HTMLElement;
    const icon = el.shadowRoot!.querySelector('.caption-icon') as HTMLElement;
    const [a, t] = [root.getBoundingClientRect(), tab.getBoundingClientRect()];
    return { step: el.getAttribute('data-step'), words: tab.textContent?.trim(), border: getComputedStyle(root).borderTopColor, tabBorder: getComputedStyle(tab).borderTopColor,
      tabShown: getComputedStyle(tab).display !== 'none', icon: getComputedStyle(icon).display !== 'none', above: Math.round(t.bottom - a.top) + 0, right: Math.round(t.right - a.right) + 0, left: t.left > a.left };
  });
  // Each caption the node says, as it says it: read after, so a busy machine still sees each second's words.
  await source.evaluate((el) => {
    const w = window as never as { said: string[] };
    w.said = [];
    new MutationObserver(() => {
      const words = el.getAttribute('data-caption');
      if (words && w.said.at(-1) !== words) w.said.push(words);
    }).observe(el, { attributes: true, attributeFilter: ['data-caption'] });
  });
  await press(page, 'fetch');
  await expect.poll(async () => (await look(source)).words, { intervals: [100] }).toBe('Fetching… 1s');
  const on = await look(source);
  expect(on).toMatchObject({ step: 'running', tabShown: true, icon: true, above: 0, right: 0, left: true });
  // The tab wears the node's own border, and the border is the active one: not what an idle node has.
  expect(on.tabBorder).toBe(on.border);
  expect(on.border).not.toBe((await look(idle)).border);
  expect(await look(idle)).toMatchObject({ step: null, tabShown: false });
  // Ended: the running look is gone, and the light says what the simulation made of it, no play icon.
  await expect.poll(async () => (await look(source)).step, { timeout: 15_000 }).toBe('done');
  expect(await look(source)).toMatchObject({ icon: false, tabShown: true });
  expect((await look(source)).words).toMatch(/^120 rows · (<1|\d+) ms$/);
  // The seconds count up: 1s, then a later one (a busy timer may skip one).
  const said = await page.evaluate(() => (window as never as { said: string[] }).said);
  expect(said[0]).toBe('Fetching… 1s');
  expect(said.some((w) => /^Fetching… [2-9]s$/.test(w)), said.join(' | ')).toBe(true);
});

test('a simulation shows the node it is on, node by node, "Simulating… 1s", then takes the look off every node', async ({ page }) => {
  await start(page, { big: 200_000, delay: 5 });
  // Every caption a node is given, as it is given: the page may not draw between two.
  await page.evaluate(() => {
    const seen: [string, string, number, number][] = [];
    let frames = 0;
    const count = (): void => { frames++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    Object.assign(window, { seen });
    const set = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (name === 'data-caption' && this.localName === 'sherpa-node') seen.push([this.getAttribute('data-heading')!, value, frames, performance.now()]);
      return set.call(this, name, value);
    };
  });
  await press(page, 'fetch');
  await expect.poll(() => sim(page), { timeout: 30_000 }).toBeDefined();
  const seen = await page.evaluate(() => (window as never as { seen: [string, string, number, number][] }).seen);
  const mine = seen.filter(([, words]) => words.startsWith('Simulating…'));
  expect(new Set(mine.map(([heading]) => heading)).size).toBeGreaterThanOrEqual(2);
  expect(mine.every(([, words]) => /^Simulating… \d+s$/.test(words))).toBe(true);
  expect(seen.some(([heading, words]) => heading === 's' && words.startsWith('Fetching…'))).toBe(true);
  // Over: nothing runs, and each node's light says its rows and its time: 100,000 in the Source (the cap stopped the 200,000), in → out at the test, in at the end.
  await expect(page.locator('#cv > sherpa-node[data-step="running"]')).toHaveCount(0);
  const lights = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cv > sherpa-node')].map((n) => [n.getAttribute('data-heading')!, `${n.getAttribute('data-step')}|${n.getAttribute('data-caption')}`])));
  const active = 100_000 / 4;
  expect(lights['s']).toMatch(/^done\|100,000 rows · (<1|[\d,]+) ms$/);
  expect(lights['f']).toMatch(/^done\|100,000 → 100,000 · (<1|[\d,]+) ms$/);
  expect(lights['c']).toMatch(new RegExp(`^done\\|100,000 → ${active.toLocaleString('en')} · (<1|[\\d,]+) ms$`));
  // An Output says what it would do first: Simulate fires none (plan 891).
  expect(lights['o']).toMatch(new RegExp(`^done\\|Would end the run · ${active.toLocaleString('en')} rows · (<1|[\\d,]+) ms$`));
});

test('a fetch that cannot go says so once, as a critical notice, and leaves nothing half done', async ({ page }) => {
  await start(page, { known: false });
  await press(page, 'fetch');
  await expect.poll(async () => (await notices(page)).length).toBe(1);
  expect((await notices(page))[0]).toEqual({ words: 'fetch failed: the Source "s" names a store the page cannot reach', status: 'critical' });
  expect(await sim(page)).toBeUndefined();
  await expect(page.locator('sherpa-node-toolbar')).not.toHaveAttribute('data-fetching', '');
});

test('with no notify, the end notice is a toast', async ({ page }) => {
  await start(page, { collect: false });
  await press(page, 'fetch');
  await expect(page.locator('sherpa-toast')).toHaveAttribute('data-heading', 'Fetched. users: 120 rows.');
  await expect(page.locator('sherpa-toast')).toHaveAttribute('data-status', 'success');
});

test('a fetch stops at the cap and says PARTIAL: the rows kept, how many the store held, on the device too', async ({ page }) => {
  await start(page, { limit: { rows: 50 } });
  await press(page, 'fetch');
  await expect.poll(() => sim(page)).toBeDefined();
  const s = (await sim(page))!;
  const source = out(s, 's', 's/rows');
  expect(source.rows).toHaveLength(50);
  expect(source.note).toBe('PARTIAL: the first 50 of 120 rows.');
  const record = await kept(page);
  expect([record?.rows.length, record?.total]).toEqual([50, 120]);
});

test('the Data pane of a node shows its rows per socket as JSON, the first 50, with the counts in words', async ({ page }) => {
  await start(page);
  await press(page, 'fetch');
  await expect.poll(() => sim(page)).toBeDefined();
  const header = (await page.locator('#cv > sherpa-node[data-heading="c"]').boundingBox())!;
  await page.mouse.click(header.x + header.width / 2, header.y + 8);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await page.locator('#inspector sherpa-tabs.content-tabs').evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[2] as HTMLElement).click());
  const pane = page.locator('#inspector .data-pane');
  await expect(pane).toBeVisible();
  const lines = await pane.locator('.data-line').allTextContents();
  // Each socket by its label: True is 1 where a row passes; the rows that pass go by Results. No False, no Count (plan 944).
  expect(lines).toContain('True: 1');
  expect(lines).toContain(`Results: ${ACTIVE.length} rows`);
  expect(lines.filter((l) => /^(False|Count):/.test(l))).toEqual([]);
  const code = await pane.locator('sherpa-code-block').evaluateAll((els) => els.map((e) => JSON.parse(e.getAttribute('data-code')!) as { status: string }[]));
  expect(code.some((c) => c.length === ACTIVE.length && c.every((r) => r.status === 'active'))).toBe(true);
  // Each socket's rows are in the grid the pages use: a column for each field, a row for each of the rows (the first 50), the
  // same rows as JSON in a shut section beneath.
  const grids = await page.locator('#inspector .data-pane sherpa-data-grid').evaluateAll((els) => els.map((g) => ({
    body: g.shadowRoot!.querySelectorAll('tbody tr').length, heads: [...g.shadowRoot!.querySelectorAll('th.head-cell .head-label')].map((e) => e.textContent?.trim()),
    first: [...(g.shadowRoot!.querySelector('tbody tr')?.querySelectorAll('td') ?? [])].map((c) => c.textContent?.trim()).filter(Boolean), height: Math.round(g.getBoundingClientRect().height),
  })));
  expect(grids.every((g) => g.heads.join() === 'id,status' && g.height <= 280)).toBe(true);
  expect(grids.filter((g) => g.body === ACTIVE.length).every((g) => g.first[1] === 'active')).toBe(true);
  // In and Results: True, a number, carries no rows (plan 944).
  expect(grids.map((g) => g.body).sort((a, b) => a - b)).toEqual([ACTIVE.length, 50]);
  expect(await page.locator('#inspector .data-pane sherpa-accordion.data-json[open]').count()).toBe(0);
  // The Source's has 120 rows and writes out 50.
  const source = (await page.locator('#cv > sherpa-node[data-heading="s"]').boundingBox())!;
  await page.mouse.click(source.x + source.width / 2, source.y + 8);
  await expect(page.locator('#inspector .data-more')).toHaveText('The first 50 of 120 rows.');
  const rows = await page.locator('#inspector .data-pane sherpa-code-block').evaluateAll((els) => els.map((e) => (JSON.parse(e.getAttribute('data-code')!) as unknown[]).length));
  expect(rows).toContain(50);
  await page.mouse.click(header.x + header.width / 2, header.y + 8);
  // Edited since: it says stale.
  await page.locator('#cv > sherpa-node[data-heading="c"] sherpa-input-text[name="type"] select').selectOption('ne');
  await settle(page);
  await expect(page.locator('#inspector .data-stale')).toHaveText('Stale: the graph changed since this ran. Press Simulate.');
  // The lights say so too.
  await expect(page.locator('#cv > sherpa-node[data-heading="c"]')).toHaveAttribute('data-caption', /· stale$/);
});

test('the keys: Ctrl or Cmd and Enter simulates; with Shift it fetches', async ({ page }) => {
  await start(page);
  await page.locator('#cv').evaluate((cv) => (cv.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect.poll(() => sim(page)).toBeDefined();
  expect(await loads(page)).toBe(0);
  await page.keyboard.press('ControlOrMeta+Shift+Enter');
  await expect.poll(() => loads(page)).toBe(1);
  await expect.poll(async () => (await sim(page))?.faults.length).toBe(0);
});

test('a Value into a Math: Simulate sends the number, and the Math\'s light says it', async ({ page }) => {
  await start(page, { calc: true });
  await press(page, 'fetch');
  await settle(page);
  await expect.poll(() => loads(page)).toBe(1);
  await press(page, 'play');
  await expect.poll(async () => (await sim(page))?.nodes['m'] !== undefined).toBe(true);
  const s = (await sim(page))!;
  expect(out(s, 'm', 'm/result').value).toBe(42);
  expect(into(s, 'm', 'm/a').value).toBe(21);
  await expect.poll(() => page.evaluate(() => document.querySelector('#cv > sherpa-node[data-heading="m"]')!.getAttribute('data-caption'))).toMatch(/^= 42 · (<1|[\d,]+) ms$/);
});
