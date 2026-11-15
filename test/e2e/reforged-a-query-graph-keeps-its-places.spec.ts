import { test, expect, type Page } from './harness';

/**
 * A QUERY GRAPH KEEPS ITS PLACES AS ANY GRAPH DOES — plan 1004e (T6): a page's Query graph keeps where it is drawn in the
 * one place set (graph-layout.ts), so Swimlanes off puts each node back, as on a kept graph.
 *
 * TRAP T-a-place-is-no-edit
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindQueryEditor, SessionStore } = await import('/dist/app.js');
    const { QueryContext, VIEW } = await import('/dist/data.js');
    const query = new QueryContext();
    query.ask({ scope: VIEW, hold: ['region'] });
    query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
    const canvas = document.getElementById('cv') as HTMLElement & { fit(): void };
    const w = window as never as { session: unknown };
    w.session = new SessionStore();
    bindQueryEditor(canvas as never, { query } as never, { definition: { v: 1, id: 'records', source: { store: 'customers' } }, toolbar: canvas.querySelector('sherpa-node-toolbar')!, session: w.session as never });
    await window.__settled();
    canvas.fit();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const press = async (page: Page, name: string) => {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
/** Each node's place, as drawn. */
const places = (page: Page) => page.locator('#cv > sherpa-node').evaluateAll((ns) => Object.fromEntries(ns.map((n) => [n.getAttribute('data-heading'), [n.getAttribute('data-x'), n.getAttribute('data-y')]])));

test('Swimlanes on, then off: each node of a page\'s Query graph goes back where it stood', async ({ page }) => {
  const before = await places(page);
  expect(Object.keys(before).length).toBeGreaterThan(2);
  await press(page, 'lanes');
  await expect(page.locator('#cv > sherpa-node-lane').first()).toBeAttached();
  expect(await places(page)).not.toEqual(before);
  await press(page, 'lanes');
  await expect(page.locator('#cv > sherpa-node-lane')).toHaveCount(0);
  expect(await places(page)).toEqual(before);
});
