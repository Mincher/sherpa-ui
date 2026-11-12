import { test, expect, type Page } from './harness';

/**
 * A node's details panel has three tabs inside its body: Details, JSON, Data. Details is current to begin with,
 * and the reader's tab stays while another node is picked. A frame and the empty state have none.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { ArrayStore } = await import('/dist/data.js');
    const store = new ArrayStore([{ id: 1, status: 'active' }, { id: 2, status: 'trial' }]);
    const nodes = [
      { id: 's', kind: 'source', x: 0, y: 0, heading: 's', values: { store: 'users' } },
      { id: 'f', kind: 'field', x: 360, y: 0, heading: 'f', values: { field: 'status' } },
      { id: 'o', kind: 'result', x: 720, y: 0, heading: 'o' },
    ];
    const connections = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'o' }];
    const ed = bindWorkflow(canvas as never, { v: 3, id: 'w', nodes, connections } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, stores: ['users'], storeOf: () => store,
    });
    (window as never as { ed: unknown }).ed = ed;
    await window.__settled();
    await (ed as unknown as { fetch(): Promise<void> }).fetch();
    await (ed as unknown as { simulate(): Promise<void> }).simulate();
    await window.__settled();
    (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false);
  });
});

const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const strip = (page: Page) => page.locator('#inspector sherpa-tabs.content-tabs');
const labels = (page: Page) => strip(page).evaluate((el) => [...el.shadowRoot!.querySelectorAll('.tab .label')].map((t) => t.textContent));
const current = (page: Page) => strip(page).evaluate((el) => el.shadowRoot!.querySelector('.tab[data-current] .label')?.textContent);
const press = (page: Page, n: number) => strip(page).evaluate((el, k) => (el.shadowRoot!.querySelectorAll('.tab')[k] as HTMLElement).click(), n);

test('a node has Details, JSON and Data tabs; Details first; JSON and Data show theirs; the tab stays while another node is picked', async ({ page }) => {
  await header(page, 'f').click();
  await expect(strip(page)).toHaveCount(1);
  expect(await labels(page)).toEqual(['Details', 'JSON', 'Data']);
  expect(await current(page)).toBe('Details');
  await expect(page.locator('#inspector sherpa-accordion[data-heading="Incoming JSON"]')).toBeHidden();
  await press(page, 1);
  await expect(page.locator('#inspector sherpa-accordion[data-heading="Incoming JSON"]')).toBeVisible();
  await expect(page.locator('#inspector sherpa-accordion[data-heading="Outgoing JSON"]')).toBeVisible();
  await press(page, 2);
  await expect(page.locator('#inspector .data-pane')).toBeVisible();
  await header(page, 'o').focus();
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__settled());
  await expect(strip(page)).toHaveCount(1);
  expect(await current(page)).toBe('Data');
  await expect(page.locator('#inspector .data-pane')).toBeVisible();
});
