import { test, expect, type Page } from './harness';

/**
 * A GRAPH UNFURLS WHEN IT OPENS, unless a reader laid it out by hand — Will, TODO 1000 ("When a graph is loaded in the canvas
 * view it should get an unfurl applied once ready"), plan 1001 D4 A. Its places save themselves (`places-change`) and the
 * opening is no Undo step. A move marks the graph `byHand`, so it opens where the reader left it; the toolbar's Unfurl
 * clears the mark. TRAP T-a-graph-unfurls-when-it-opens
 */
type Def = { nodes: { id: string; x: number; y: number }[]; byHand?: true };

/** A graph bound on a fresh canvas, every node at one place unless `laid` gives places; each `places-change` kept. */
async function open(page: Page, laid?: Def): Promise<void> {
  await page.evaluate(async (given) => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const w = window as never as { kept: Def[]; ed: unknown };
    w.kept = [];
    canvas.addEventListener('places-change', (e) => w.kept.push((e as CustomEvent).detail.definition));
    const at = (id: string, kind: string, values?: Record<string, unknown>) => ({ id, kind, x: 0, y: 0, heading: id, ...(values ? { values } : {}) });
    const graph = given ?? { v: 3, id: 'opens', nodes: [at('s', 'source', { store: 'users' }), at('f', 'field', { field: 'status' }), at('o', 'result')],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'o' }] };
    w.ed = bindWorkflow(canvas as never, graph as never, { session: new SessionStore(), toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'] });
    await window.__settled();
  }, laid ?? null);
  await settle(page);
  await settle(page);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const kept = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { kept: Def[] }).kept)) as Def[]);
const xs = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv > sherpa-node')].filter((n) => !n.getAttribute('data-heading')?.startsWith('Start')).map((n) => Number(n.getAttribute('data-x'))));

test('it opens unfurled, its places saved and no Undo step; moved by hand, it opens where it was left; Unfurl clears the mark', async ({ page }) => {
  await open(page);
  // Unfurled: the nodes stand apart, and the kept graph took the places, with no mark.
  expect(new Set(await xs(page)).size).toBeGreaterThan(1);
  const [first] = await kept(page);
  expect(first?.byHand).toBeUndefined();
  await expect(page.locator('sherpa-node-toolbar')).not.toHaveAttribute('data-can-undo', '');
  // A move by hand marks it.
  const head = (await page.locator('#cv > sherpa-node[data-heading="o"] .header[role="button"]').boundingBox())!;
  await page.mouse.move(head.x + 30, head.y + 10);
  await page.mouse.down();
  await page.mouse.move(head.x + 90, head.y + 70, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const moved = (await kept(page)).at(-1)!;
  expect(moved.byHand).toBe(true);
  // Opened again from what was kept: it stays where the reader left it.
  await open(page, moved);
  expect(await kept(page)).toEqual([]);
  expect(await xs(page)).toEqual(moved.nodes.filter((n) => !n.id.startsWith('#')).map((n) => n.x));
  // Unfurl clears the mark: it will unfurl when it opens again.
  await page.locator('sherpa-node-toolbar sherpa-button.unfurl').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect((await kept(page)).at(-1)?.byHand).toBeUndefined();
});

test('a graph too wide to read whole opens at a readable zoom, its Start at the left middle; Fit still shows it all; a small one opens whole (1001c, Will A)', async ({ page }) => {
  /** The view's zoom, and the Start's middle-left in the stage the view shows, as a share of the stage's width and height. */
  const view = () => page.evaluate(() => {
    const canvas = document.getElementById('cv') as HTMLElement & { view: { zoom: number } };
    const stage = canvas.shadowRoot!.querySelector('.stage')!.getBoundingClientRect();
    const start = [...canvas.querySelectorAll('sherpa-node')].find((n) => n.getAttribute('data-heading')?.startsWith('Start'))!.getBoundingClientRect();
    return { zoom: canvas.view.zoom, left: (start.left - stage.left) / stage.width, middle: (start.top + start.height / 2 - stage.top) / stage.height };
  });
  await open(page);
  expect((await view()).zoom).toBeGreaterThan(0.35);
  const at = (id: string, kind: string, values?: Record<string, unknown>) => ({ id, kind, x: 0, y: 0, heading: id, ...(values ? { values } : {}) });
  const sorts = Array.from({ length: 12 }, (_, i) => at(`o${i}`, 'organise', { sort: 'status', direction: 'asc' }));
  await open(page, { v: 3, id: 'wide', nodes: [at('s', 'source', { store: 'users' }), ...sorts, at('r', 'result')],
    connections: [{ from: 's/rows', to: 'o0' }, ...sorts.slice(1).map((n, i) => ({ from: `o${i}/rows`, to: n.id })), { from: 'o11/rows', to: 'r' }] } as never);
  const opened = await view();
  expect(opened.zoom).toBeCloseTo(0.35, 3);
  // The Start near the left middle: a reader reads from the left.
  expect(opened.left).toBeGreaterThan(0);
  expect(opened.left).toBeLessThan(0.1);
  expect(Math.abs(opened.middle - 0.5)).toBeLessThan(0.25);
  // Fit, and a zoom out by hand, still reach all of it.
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { fit(): void }).fit());
  expect((await view()).zoom).toBeLessThan(0.3);
});

test('a view its host sets while the graph opens is kept: the opening unfurls the graph, and leaves the view (1001c)', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const at = (id: string, kind: string, values?: Record<string, unknown>) => ({ id, kind, x: 0, y: 0, heading: id, ...(values ? { values } : {}) });
    bindWorkflow(canvas as never, { v: 3, id: 'held', nodes: [at('s', 'source', { store: 'users' }), at('f', 'field', { field: 'status' }), at('o', 'result')],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'o' }] } as never, { session: new SessionStore(), toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'] });
    await window.__settled();
    canvas.zoomTo(0.5);
    canvas.panTo(360, 60);
  });
  await settle(page);
  await settle(page);
  expect(new Set(await xs(page)).size).toBeGreaterThan(1);
  expect(await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { view: unknown }).view)).toEqual({ x: 360, y: 60, zoom: 0.5 });
});

test('settled() waits for the opening Unfurl: what measures after one settled() measures the unfurled graph, in its view (1001c)', async ({ page }) => {
  const read = () => page.evaluate(() => ({
    xs: [...document.querySelectorAll('#cv > sherpa-node')].map((n) => n.getAttribute('data-x')),
    view: (document.getElementById('cv') as HTMLElement & { view: unknown }).view,
  }));
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const at = (id: string, kind: string, values?: Record<string, unknown>) => ({ id, kind, x: 0, y: 0, heading: id, ...(values ? { values } : {}) });
    bindWorkflow(canvas as never, { v: 3, id: 'once', nodes: [at('s', 'source', { store: 'users' }), at('f', 'field', { field: 'status' }), at('o', 'result')],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'o' }] } as never, { session: new SessionStore(), toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'] });
    await window.__settled();
  });
  const once = await read();
  expect(new Set(await xs(page)).size).toBeGreaterThan(1);
  await settle(page);
  await settle(page);
  expect(await read()).toEqual(once);
});
