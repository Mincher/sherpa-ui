import { test, expect, type Page } from './harness';

/**
 * A Source with no store draws ONE default, the same every time (TODO 824): "Pick a store", its
 * value none, on its first draw, after a redraw (a move, Arrange, Undo) and in the inspector.
 * A select with no value it lists shows its FIRST choice on the first draw, then nothing after a
 * redraw: the reader saw a store the graph did not hold. Picked, the list is the stores alone.
 * Real pointer and keys.
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 640px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv')!;
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, {
      v: 2, id: 'g', nodes: [{ id: 'none', kind: 'source', x: 0, y: 0 }, { id: 'orders', kind: 'source', x: 380, y: 0, values: { store: 'orders' } }],
    } as never, { session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as never, stores: ['users', 'orders'] });
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const header = (page: Page, nth: number) => page.locator('#cv > sherpa-node[data-heading="Source"]').nth(nth).locator('.header[role="button"]');
/** What a Store field shows and holds: its value, the words its select shows, and its choices. */
const store = (page: Page, where: string) => page.locator(where).first().evaluate((f) => {
  const select = f.shadowRoot!.querySelector('select')!;
  return { value: (f as HTMLElement & { value: string }).value, shows: select.selectedIndex < 0 ? '' : select.options[select.selectedIndex]!.textContent, choices: [...select.options].map((o) => o.textContent) };
});
const ON_CANVAS = '#cv > sherpa-node:nth-of-type(1) sherpa-input-text[name="store"]';
const PICK = { value: '', shows: 'Pick a store', choices: ['Pick a store', 'users', 'orders'] };

test('a Source with no store says Pick a store on its first draw, after a move, after Undo, and in its inspector', async ({ page }) => {
  expect(await store(page, ON_CANVAS)).toEqual(PICK);
  // The one with a store shows it, and lists only the stores.
  expect(await store(page, '#cv > sherpa-node:nth-of-type(2) sherpa-input-text[name="store"]')).toEqual({ value: 'orders', shows: 'orders', choices: ['users', 'orders'] });
  // A redraw: the other Source moved by the keys.
  await header(page, 1).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await settle(page);
  expect(await store(page, ON_CANVAS)).toEqual(PICK);
  await page.locator('#cv sherpa-node-toolbar sherpa-button.undo').click();
  await settle(page);
  expect(await store(page, ON_CANVAS)).toEqual(PICK);
  // Its inspector, by the pointer: the same.
  await header(page, 0).click();
  await settle(page);
  expect(await store(page, '#inspector sherpa-input-text[name="store"]')).toEqual(PICK);
});

test('a store picked is the only one shown; Undo gives Pick a store back', async ({ page }) => {
  await page.locator(ON_CANVAS).locator('select').selectOption('users');
  await settle(page);
  expect(await store(page, ON_CANVAS)).toEqual({ value: 'users', shows: 'users', choices: ['users', 'orders'] });
  await page.locator('#cv sherpa-node-toolbar sherpa-button.undo').click();
  await settle(page);
  expect(await store(page, ON_CANVAS)).toEqual(PICK);
});
