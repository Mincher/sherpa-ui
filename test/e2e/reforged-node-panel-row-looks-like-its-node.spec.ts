import { test, expect, type Page } from './harness';

/**
 * A row of the Nodes panel looks like its node on the canvas (Will, TODO 840): the list item's `data-type="node"` takes the
 * node's own fill, border and corner radii by its kind's category, from one sheet both adopt. Read by the boxes' computed
 * radii and by pixels, for a Source (tinted, round on two corners), an Output (tinted, round on the other two), a Custom Node
 * (tinted) and a Condition (no tint). TRAP T-a-node-row-wears-its-nodes-look
 */
const LIBRARY = { v: 1, nodes: { mine: { v: 1, label: 'Mine', inputs: [], outputs: [], nodes: [] } } };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async (library) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1400px; block-size: 760px"><sherpa-overlay-panel slot="panel" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const canvas = document.getElementById('cv')! as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    bindWorkflow(canvas as never, { v: 2, id: 'g', nodes: [
      { id: 's', kind: 'source', x: 500, y: 60, values: { store: 'users' } }, { id: 'o', kind: 'output', x: 900, y: 60 }, { id: 'c', kind: 'condition', x: 500, y: 400 },
      useOf(library as never, 'mine', { id: 'm', x: 900, y: 400 }),
    ] } as never, { session: new SessionStore(), panel: canvas.querySelector('sherpa-node-list') as never, stores: ['users'], library: library as never });
    await window.__settled();
    canvas.zoomTo(1);
    canvas.panTo(0, 0);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, LIBRARY);
});

/** What a box draws: its four corner radii, its border's width, and its colour at a point just inside its top edge, in the middle. */
type Look = { radii: string[]; border: number; fill: [number, number, number] };
async function look(page: Page, box: { x: number; y: number; width: number }, radii: string[], border: string): Promise<Look> {
  const shot = await page.screenshot({ clip: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y) + 4, width: 1, height: 1 } });
  const fill = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3) as [number, number, number];
  }, shot.toString('base64'));
  return { radii, border: parseFloat(border), fill };
}
const nodeLook = async (page: Page, heading: string): Promise<Look> => {
  const el = page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
  const box = (await el.boundingBox())!;
  const [radii, border] = await el.evaluate((n) => { const s = getComputedStyle(n.shadowRoot!.querySelector('.root')!); return [[s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius], s.borderTopWidth] as const; });
  return look(page, box, [...radii], border);
};
const rowLook = async (page: Page, kind: string): Promise<Look> => {
  const el = page.locator(`sherpa-node-list sherpa-list-item[data-kind="${kind}"]`).first();
  await el.scrollIntoViewIfNeeded();
  const box = (await el.boundingBox())!;
  const [radii, border] = await el.evaluate((n) => { const s = getComputedStyle(n.shadowRoot!.querySelector('.row')!); return [[s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius], s.borderTopWidth] as const; });
  return look(page, box, [...radii], border);
};
const near = (a: number[], b: number[], within = 8): boolean => a.every((v, i) => Math.abs(v - b[i]!) <= within);

test('a Source\'s row is its node\'s: the same tint, the same two round corners, a border; an Output\'s the other two', async ({ page }) => {
  for (const [kind, heading] of [['source', 'Source'], ['output', 'Output']] as const) {
    const [row, node] = [await rowLook(page, kind), await nodeLook(page, heading)];
    expect(row.radii, `${kind}: its corners`).toEqual(node.radii);
    expect(row.border, `${kind}: it has a border`).toBeGreaterThan(0);
    expect(near(row.fill, node.fill), `${kind}: its fill ${row.fill} is its node's ${node.fill}`).toBe(true);
  }
  // The Source rounds its top-left and bottom-right; the Output the other two: a node's own, not one shape for all.
  const [s, o] = [await rowLook(page, 'source'), await rowLook(page, 'output')];
  expect(s.radii[0]).not.toBe(s.radii[1]);
  expect(s.radii[0]).toBe(o.radii[1]);
});

test('a Condition\'s row has no tint and a plain 4px; a Custom Node\'s, its node\'s tint', async ({ page }) => {
  const [row, node] = [await rowLook(page, 'condition'), await nodeLook(page, 'Condition')];
  expect(row.radii).toEqual(node.radii);
  expect(new Set(row.radii).size).toBe(1);
  expect(near(row.fill, node.fill), `its fill ${row.fill} is its node's ${node.fill}`).toBe(true);
  // Custom Nodes is a tab of its own.
  await page.locator('sherpa-node-list sherpa-tabs').evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[1] as HTMLElement).click());
  const [mine, mineNode] = [await rowLook(page, 'mine'), await nodeLook(page, 'Mine')];
  expect(mine.radii).toEqual(mineNode.radii);
  expect(near(mine.fill, mineNode.fill), `its fill ${mine.fill} is its node's ${mineNode.fill}`).toBe(true);
  expect(mine.fill).not.toEqual(row.fill);
});
