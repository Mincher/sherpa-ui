import { test, expect, type Page } from './harness';

/**
 * The ACTIVE border shows what is JOINED to the pick (Will, TODO 889): a picked node lights every node downstream of it; a
 * picked connection lights the nodes it joins; a row's field in focus lights each node joined to that row — and a row whose
 * output another row wears (a Source's Rows, on its Store) counts as that row. A picked node wears the picked look, not
 * this. Real pointer and real focus.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1200px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, id: 'joined',
      nodes: [
        { id: 'one', kind: 'value', x: 40, y: 380, heading: 'One', values: { type: 'integer', value: '1' } },
        { id: 's', kind: 'source', x: 40, y: 40, values: { store: 'users' } },
        { id: 'f', kind: 'field', x: 340, y: 40, values: { field: 'status' } },
        { id: 'c', kind: 'condition', x: 640, y: 40, heading: 'Active', values: { type: 'eq', b: 'active' } },
        { id: 'or', kind: 'condition', x: 940, y: 260, heading: 'Either', values: { type: 'or' } },
      ],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c', to: 'or' }, { from: 'one/value', to: 'or' }],
    };
    bindWorkflow(el as never, flow as never, { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { status: { label: 'Status' } } } });
    (el as unknown as { zoomTo(z: number): void; panTo(x: number, y: number): void }).zoomTo(1);
    (el as unknown as { panTo(x: number, y: number): void }).panTo(0, 0);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

/** The headings of the nodes that wear the active border, in order. */
const joined = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv > sherpa-node[data-joined]')].map((n) => n.getAttribute('data-heading')).sort());

test('a picked node lights every node downstream of it, and not itself', async ({ page }) => {
  const field = page.locator('#cv > sherpa-node[data-heading="Field"]');
  const b = (await field.locator('.header[role="button"]').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + 8);
  await expect(field).toHaveAttribute('data-current', '');
  await expect.poll(() => joined(page)).toEqual(['Active', 'Either']);
  await expect(field).not.toHaveAttribute('data-joined');
  // A click on the bare canvas picks nothing: nothing is lit.
  const cv = (await page.locator('#cv').boundingBox())!;
  await page.mouse.click(cv.x + 600, cv.y + 600);
  await expect(field).not.toHaveAttribute('data-current');
  await expect.poll(() => joined(page)).toEqual([]);
});

test('a picked connection lights the two nodes it joins', async ({ page }) => {
  const at = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#cv .graph-hit[data-from="f/field"][data-to="c"]')!;
    const pts = hit.points;
    const p = pts.getItem(Math.floor(pts.numberOfItems / 2));
    const s = new DOMPoint(p.x, p.y).matrixTransform(hit.getScreenCTM()!);
    return [s.x, s.y] as [number, number];
  });
  await page.mouse.click(...at);
  await expect.poll(() => joined(page)).toEqual(['Active', 'Field']);
});

test('a row\'s field in focus lights each node joined to that row; a Store lights what its Source\'s Rows feed', async ({ page }) => {
  await page.locator('#cv > sherpa-node[data-heading="Field"] sherpa-input-text[name="field"] select').focus();
  await expect.poll(() => joined(page)).toEqual(['Active']);
  await page.locator('#cv > sherpa-node[data-heading="Source"] sherpa-input-text[name="store"] select').focus();
  await expect.poll(() => joined(page)).toEqual(['Field']);
  await page.locator('#cv > sherpa-node[data-heading="Source"] sherpa-input-text[name="store"] select').blur();
  await expect.poll(() => joined(page)).toEqual([]);
});
