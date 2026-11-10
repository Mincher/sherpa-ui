import { test, expect, type Page } from './harness';

/**
 * SWIMLANES on a workflow's canvas — Will, 2026-11-10. The toolbar's Swimlanes turns them on: a row for each family of
 * nodes that has one (Data, Values, Organise, Output…), a logic node in the junction between the lanes it joins; each
 * band holds its nodes, and none overlaps the next. Off, the rows go and the nodes stay. One step each.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas, { v: 2, id: 'g', nodes: [
      { id: 'src', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'val', kind: 'value', x: 0, y: 40 },
      { id: 'cond', kind: 'condition', x: 330, y: 20 },
      { id: 'sort', kind: 'sort', x: 660, y: 20 },
      { id: 'end', kind: 'output', x: 990, y: 0 },
    ], routes: [{ from: 'src/rows', to: 'cond' }, { from: 'val/value', to: 'cond/b' }, { from: 'cond/rows', to: 'sort' }, { from: 'sort/rows', to: 'end' }] }, {
      session: new SessionStore(), inspector: document.getElementById('inspector'),
      toolbar: canvas.querySelector('sherpa-node-toolbar'), stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status', values: ['active'] } } },
    });
    await window.__settled();
    canvas.zoomTo(0.4);
    canvas.panTo(40, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const press = async (page: Page, name: string) => {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
const lanes = (page: Page) => page.locator('#cv > sherpa-node-lane').evaluateAll((ls) => ls.map((l) => ({
  heading: l.getAttribute('data-heading'), type: l.getAttribute('data-type'), top: Number(l.getAttribute('data-y')), bottom: Number(l.getAttribute('data-y')) + Number(l.getAttribute('data-h')),
})));
/** A node's top and bottom, in plane px, as drawn. */
const span = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).evaluate((n) => ({ top: Number(n.getAttribute('data-y')), bottom: Number(n.getAttribute('data-y')) + (n as HTMLElement).offsetHeight }));

test('Swimlanes on: a band for each family that has a node, the logic node in a junction, no band over the next; off, they go', async ({ page }) => {
  await expect(page.locator('#cv > sherpa-node-lane')).toHaveCount(0);
  await press(page, 'lanes');
  await expect(page.locator('sherpa-node-toolbar sherpa-button.lanes')).toHaveAttribute('aria-pressed', 'true');
  const bands = await lanes(page);
  expect(bands.map((b) => b.heading)).toEqual(['Data', 'Values', 'Junction', 'Organise', 'Output']);
  expect(bands[2]!.type).toBe('junction');
  for (let i = 1; i < bands.length; i++) expect(bands[i]!.top).toBeGreaterThan(bands[i - 1]!.bottom);
  // Each node inside its band.
  for (const [heading, band] of [['Source', 0], ['Value', 1], ['Condition', 2], ['Sort', 3], ['Output', 4]] as const) {
    const s = await span(page, heading);
    expect(s.top).toBeGreaterThanOrEqual(bands[band]!.top);
    expect(s.bottom).toBeLessThanOrEqual(bands[band]!.bottom);
  }
  // Off: the rows go, the nodes stay where the lanes put them; Undo turns them back on.
  const placed = await span(page, 'Output');
  await press(page, 'lanes');
  await expect(page.locator('#cv > sherpa-node-lane')).toHaveCount(0);
  expect(await span(page, 'Output')).toEqual(placed);
  await press(page, 'undo');
  await expect(page.locator('#cv > sherpa-node-lane')).toHaveCount(5);
});
