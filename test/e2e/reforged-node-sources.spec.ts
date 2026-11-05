import { test, expect, type Page } from './harness';

/**
 * Sources — Will, TODOs 808 and 809: "I should be able to add a Source node to a graph. Multiple Sources are allowed."
 * Two Sources dragged from the panel, each its own id and store; the panel's lines are each kind's short synopsis, and
 * search still finds a type by its name. In a page's Query a second Source is kept and warns, an Undo step, deleted by
 * the keys; it asks the Query nothing. Real pointer. TRAP T-a-second-source-is-kept
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
        <sherpa-node-panel slot="panel"></sherpa-node-panel>
      </sherpa-layout-canvas>`);
    await Promise.all(['sherpa-node-panel', 'sherpa-node-toolbar', 'sherpa-layout-canvas'].map((t) => customElements.whenDefined(t)));
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const item = (page: Page, kind: string) => page.locator(`sherpa-node-panel sherpa-list-item[data-kind="${kind}"]`);
const sources = '#cv > sherpa-node[data-heading="Source"]';

/** Drag a panel item onto the canvas by the real pointer, let go at a point. */
async function drop(page: Page, kind: string, x: number, y: number): Promise<void> {
  const from = (await item(page, kind).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + 40, { steps: 4 });
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
  await settle(page);
}

test('two Sources dragged into a workflow: each its own id, customers and devices; the panel says each kind in a few words, and search finds a type', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv')!;
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, { v: 2, id: 'both', nodes: [], routes: [] }, {
      session: new SessionStore(), panel: canvas.querySelector('sherpa-node-panel') as never, stores: ['customers', 'devices'],
    });
    await window.__settled();
  });
  await drop(page, 'source', 520, 160);
  await drop(page, 'source', 520, 400);
  // The first reads customers, the second devices: each its Store row's own select.
  for (const [at, store] of [[0, 'customers'], [1, 'devices']] as const) {
    await page.locator(sources).nth(at).locator('sherpa-input-text[name="store"] select').selectOption(store);
    await settle(page);
  }
  const kept = () => page.evaluate(() => (window as unknown as { ed: { workflow(): { nodes: { id: string; kind: string; values?: { store?: string } }[] } } }).ed.workflow().nodes
    .map((n) => [n.id, n.kind, n.values?.store ?? null]));
  expect(await kept()).toEqual([['source-1', 'source', 'customers'], ['source-2', 'source', 'devices']]);
  await expect(page.locator(sources)).toHaveCount(2);
  // 809: every line is a few words, on one line; a family's never lists its types.
  const lines = await page.locator('sherpa-node-panel sherpa-list-item').evaluateAll((els) => els.map((e) => [e.getAttribute('data-kind'), e.getAttribute('data-description')]));
  expect(Object.fromEntries(lines)).toMatchObject({ source: 'Rows from a store.', value: 'One value, typed.', math: 'Numbers in, one number out.' });
  for (const [kind, line] of lines) expect(line!.split(/\s+/).length, `${kind}: "${line}"`).toBeLessThanOrEqual(6);
  // The types stay in search: "integer" finds Value, says Integer, and places it so.
  await page.locator('sherpa-node-panel sherpa-input-text.find input').fill('integer');
  await expect(page.locator('sherpa-node-panel sherpa-list-item:visible')).toHaveCount(1);
  await expect(item(page, 'value')).toHaveAttribute('data-description', 'Integer: A whole number, as 42');
  await item(page, 'value').click();
  await settle(page);
  expect((await kept()).at(-1)).toEqual(['value-1', 'value', null]);
  expect(await page.evaluate(() => (window as unknown as { ed: { workflow(): { nodes: { values?: { type?: string } }[] } } }).ed.workflow().nodes.at(-1)!.values?.type)).toBe('integer');
});

/** A page's Query on the canvas: a fake whose every ask is kept, and what is reported. */
async function bindQuery(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { bindQueryEditor, SessionStore } = await import('/dist/app.js');
    const { onReport } = await import('/dist/data.js');
    const w = window as unknown as { asked: unknown[]; said: string[]; ed: unknown };
    w.asked = [];
    w.said = [];
    onReport((r) => w.said.push(r.message));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['region'], readings: {} } } },
      ask: (request: unknown) => w.asked.push(request),
      presets: () => [], presetOn: () => false, scope: () => ['region'], fields: () => ['region'], waiting: () => false,
    });
    const canvas = document.getElementById('cv')!;
    w.ed = bindQueryEditor(canvas as never, { query } as never, {
      definition: { v: 1, id: 'records', source: { store: 'customers', fields: { region: { label: 'Region' } } } },
      stores: ['customers', 'devices'], session: new SessionStore(),
      panel: canvas.querySelector('sherpa-node-panel') as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as HTMLElement,
    });
    await window.__settled();
  });
}
/** Each Source drawn: its store and its warning. */
const drawn = (page: Page) => page.locator(sources).evaluateAll((els) => els.map((e) => [
  (e.querySelector('sherpa-input-text[name="store"]') as HTMLElement & { value: string } | null)?.value ?? null, e.getAttribute('data-warning'),
]));
const asked = (page: Page) => page.evaluate(() => (window as unknown as { asked: unknown[] }).asked);
const said = (page: Page) => page.evaluate(() => (window as unknown as { said: string[] }).said);

test('a page\'s Query offers Source; a second is kept and warns, an Undo step, deleted by the keys; it asks the Query nothing', async ({ page }) => {
  await bindQuery(page);
  await expect(page.locator('sherpa-node-panel .category-heading').first()).toHaveAttribute('data-heading', 'Sources');
  expect(await drawn(page)).toEqual([['customers', null]]);
  await drop(page, 'source', 640, 420);
  const warns = 'The page reads customers. This Source is not the page\'s: the Query reads nothing from it.';
  expect(await drawn(page)).toEqual([['customers', null], ['devices', warns]]);
  // Its Store is the reader's to pick: the page's own is the definition's.
  await page.locator(`${sources}[data-warning] sherpa-input-text[name="store"] select`).selectOption('customers');
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null], ['customers', warns]]);
  // Undo steps the pick, then the place; Redo brings the place back.
  const undo = page.locator('sherpa-node-toolbar sherpa-button.undo');
  await undo.click();
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null], ['devices', warns]]);
  await undo.click();
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null]]);
  await page.locator('sherpa-node-toolbar sherpa-button.redo').click();
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null], ['devices', warns]]);
  // Delete takes the kept one; the page's own is a reading, and stays, in words.
  await page.locator(`${sources}[data-warning] >> .header[role="button"]`).click();
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null]]);
  expect(await said(page)).toEqual([]);
  await page.locator(`${sources} >> .header[role="button"]`).click();
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await drawn(page)).toEqual([['customers', null]]);
  expect(await said(page)).toEqual([expect.stringMatching(/^The Query's nodes are its readings/)]);
  expect(await asked(page), 'nothing was asked of the Query').toEqual([]);
});
