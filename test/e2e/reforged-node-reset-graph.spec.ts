import { test, expect, type Page } from './harness';

/**
 * RESET NODE GRAPH — Will, TODO 837. An editor bound with the app header turns on the view bar's `data-reset-graph`: its ⋮ is the
 * one control left, and holds "Reset node graph" alone, inactive while the graph is as loaded. Pressed, the graph is back to its
 * starting definition as ONE step, a draft; a node edit makes it active; Undo takes the reset back. Real pointer.
 * The toolbar says `graph-reset`, the editor answers. A preset's graph never changes, so never offers it.
 */
type Ed = { workflow(): { nodes: { id: string; x: number; y: number }[] }; undo(): boolean; save(): boolean };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <div id="head"><sherpa-quick-filter-toolbar data-type="view" data-scope="view" data-no-actions style="display:block"></sherpa-quick-filter-toolbar></div>
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 520px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-quick-filter-toolbar');
    const head = document.getElementById('head') as HTMLElement & { populate?: () => void };
    head.populate = () => undefined;
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 3, id: 'g', nodes: [{ id: 'a', kind: 'source', x: 40, y: 40, values: { store: 'customers' } }, { id: 'b', kind: 'result', x: 400, y: 40 }], connections: [{ from: 'a/rows', to: 'b' }] };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, { session: new SessionStore(), header: head as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['customers'] });
    await window.__settled();
  });
});

const bar = '#head sherpa-quick-filter-toolbar';
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const more = (page: Page) => page.locator(`${bar} [data-act="overflow"]`);
const rows = (page: Page) => page.locator(`${bar} .more-menu .more-item`).evaluateAll((els) => els.map((e) => [e.textContent?.trim(), e.hasAttribute('disabled')]));
const place = (page: Page) => page.evaluate(() => (window as never as { ed: Ed }).ed.workflow().nodes.find((n) => n.id === 'b')!.x);

test('the bar\'s ⋮ is the one control and holds Reset node graph alone, inactive while the graph is as loaded', async ({ page }) => {
  await expect(page.locator(bar)).toHaveAttribute('data-reset-graph', '');
  await expect(more(page)).toBeVisible();
  await more(page).click();
  expect(await rows(page)).toEqual([['Reset node graph', true]]);
});

test('a node moved makes it active; pressed, the graph is back as loaded in ONE step, and Undo puts the move back; nothing is saved', async ({ page }) => {
  await page.evaluate(() => { (window as never as { saved: unknown[] }).saved = []; document.addEventListener('definition-save', (e) => (window as never as { saved: unknown[] }).saved.push((e as CustomEvent).detail)); });
  const head = (await page.locator('#cv > sherpa-node[data-heading="Run result"] sherpa-container-header').boundingBox())!;
  await page.mouse.move(head.x + head.width * 0.4, head.y + head.height / 2);
  await page.mouse.down();
  await page.mouse.move(head.x + head.width * 0.4 + 50, head.y + 60, { steps: 5 });
  await page.mouse.up();
  await settle(page);
  const moved = await place(page);
  expect(moved).not.toBe(400);
  await more(page).click();
  expect(await rows(page)).toEqual([['Reset node graph', false]]);
  await page.locator(`${bar} .more-menu .more-item`).click();
  await settle(page);
  expect(await place(page)).toBe(400);
  expect(await page.evaluate(() => (window as never as { saved: unknown[] }).saved.length)).toBe(0);
  await more(page).click();
  expect(await rows(page)).toEqual([['Reset node graph', true]]);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.undo())).toBe(true);
  await settle(page);
  expect(await place(page)).toBe(moved);
});
