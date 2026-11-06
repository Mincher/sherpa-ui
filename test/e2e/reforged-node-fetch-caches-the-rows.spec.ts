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

async function start(page: Page, options: { limit?: { rows?: number }; delay?: number; collect?: boolean; known?: boolean } = {}): Promise<void> {
  await page.evaluate(async ([rows, limit, delay, collect, known]) => {
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
    const nodes = [
      { id: 's', kind: 'source', x: 0, y: 0, heading: 's', values: { store: 'users' } }, { id: 'f', kind: 'field', x: 360, y: 0, heading: 'f', values: { field: 'status' } },
      { id: 'c', kind: 'condition', x: 720, y: 0, heading: 'c', values: { type: 'eq', b: 'active' } }, { id: 'o', kind: 'output', x: 1080, y: 0, heading: 'o' },
    ];
    const routes = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/rows', to: 'o' }];
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, { v: 2, id: 'w', nodes, routes } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!,
      stores: ['users'], storeOf: (id: string) => (known && id === 'users' ? store : undefined), tasks: new TaskQueue({ wait: 40 }), ...(limit ? { fetchLimit: limit } : {}),
      ...(collect ? { notify: (words: string, status: string) => notices.push({ words, status }) } : {}),
    });
    await window.__settled();
    canvas.zoomTo(0.4);
    canvas.panTo(20, 20);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [ROWS, options.limit ?? null, options.delay ?? 5, options.collect ?? true, options.known ?? true] as const);
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
  await press(page, 'simulate');
  await expect.poll(() => sim(page)).toBeDefined();
  let s = (await sim(page))!;
  expect(out(s, 's', 's/rows').note).toBe('Not fetched yet');
  expect(s.faults).toContain('"s" is not fetched yet');
  expect(await loads(page)).toBe(0);
  await expect(tool(page, 'fetch')).toHaveAttribute('data-tip', /^Fetch the rows/);
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

test('a Count row is the row count: the Source\'s is its rows, the Condition\'s those it kept', async ({ page }) => {
  await start(page);
  await press(page, 'fetch');
  await expect.poll(() => sim(page)).toBeDefined();
  const s = (await sim(page))!;
  expect(out(s, 's', 's/count').value).toBe(120);
  expect(out(s, 'c', 'c/count').value).toBe(ACTIVE.length);
  expect(out(s, 'f', 'f/count').value).toBe(120);
});

test('an edit and Simulate read no more: the last simulation is stale after the edit, and the store is read once', async ({ page }) => {
  await start(page);
  await press(page, 'fetch');
  await expect.poll(() => sim(page)).toBeDefined();
  await page.locator('#cv > sherpa-node[data-heading="c"] sherpa-input-text[name="type"] select').selectOption('ne');
  await settle(page);
  expect((await sim(page))!.stale).toBe(true);
  expect(into((await sim(page))!, 'o', 'o').rows).toEqual(ACTIVE);
  await press(page, 'simulate');
  await expect.poll(async () => (await sim(page))?.stale).toBe(false);
  expect(into((await sim(page))!, 'o', 'o').rows).toEqual(ROWS.filter((r) => r.status !== 'active'));
  expect(await loads(page)).toBe(1);
  // Fetch again is Refetch: one more read, and the same rows.
  await press(page, 'fetch');
  await expect.poll(() => loads(page)).toBe(2);
});

test('Fetch is a task: its button is busy while it runs, a second press is blocked and said, and ONE notice says how it ended', async ({ page }) => {
  await start(page, { delay: 500 });
  await press(page, 'fetch');
  await expect(page.locator('sherpa-node-toolbar')).toHaveAttribute('data-fetching', '');
  await expect(tool(page, 'fetch')).toHaveAttribute('aria-busy', 'true');
  await expect(tool(page, 'fetch')).toHaveAttribute('data-tip', 'Fetching: wait for it to end');
  // Pressed again, and Simulate with it: the graph's fetch is not done, so both are blocked, and each says what is in the way.
  await press(page, 'fetch');
  await press(page, 'simulate');
  expect((await notices(page)).map((n) => n.words)).toEqual(['Fetch is still running: wait for it to end.', 'Fetch is still running: wait for it to end.']);
  expect(await loads(page)).toBeLessThanOrEqual(1);
  await expect.poll(() => sim(page)).toBeDefined();
  await expect(tool(page, 'fetch')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('sherpa-node-toolbar')).not.toHaveAttribute('data-fetching', '');
  // The end: one notice, how it went.
  await expect.poll(async () => (await notices(page)).length).toBe(3);
  expect(await loads(page)).toBe(1);
  expect((await notices(page))[2]).toEqual({ words: 'Fetched. users: 120 rows.', status: 'success' });
  expect(await kept(page)).toMatchObject({ rows: expect.any(Array) });
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
  const pane = page.locator('#inspector .data-pane');
  await expect(pane).toBeVisible();
  const lines = await pane.locator('.data-line').allTextContents();
  expect(lines).toContain(`True: ${ACTIVE.length} rows`);
  expect(lines).toContain('False: ' + (120 - ACTIVE.length) + ' rows');
  expect(lines).toContain('Count: ' + ACTIVE.length);
  const code = await pane.locator('sherpa-code-block').evaluateAll((els) => els.map((e) => JSON.parse(e.getAttribute('data-code')!) as { status: string }[]));
  expect(code.some((c) => c.length === ACTIVE.length && c.every((r) => r.status === 'active'))).toBe(true);
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
