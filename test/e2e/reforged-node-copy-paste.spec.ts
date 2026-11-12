import { test, expect, type Page } from './harness';

/**
 * The node editor's copy and paste — Will, 2026-11-10. Cmd/Ctrl+C copies the picked nodes; Cmd/Ctrl+V pastes them with no
 * connections; Shift+Cmd/Ctrl+V pastes them with the connections into, between and out of them. Alt and a drag on a node drags a copy;
 * Alt+Shift keeps its connections. Each is ONE step. Real pointer and keys.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas, { v: 3, id: 'g', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'sort', kind: 'sort', x: 330, y: 0, values: { direction: 'asc' } },
      { id: 'end', kind: 'result', x: 660, y: 0 },
    ], connections: [{ from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'end' }] }, {
      session: new SessionStore(), inspector: document.getElementById('inspector'),
      toolbar: canvas.querySelector('sherpa-node-toolbar'), stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status', values: ['active'] } } },
    });
    await window.__settled();
    canvas.zoomTo(0.6);
    canvas.panTo(120, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => (window as never as { ed: { workflow(): { nodes: { id: string; kind: string; x: number; y: number }[]; connections: { from: string; to: string }[] } } }).ed.workflow());
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const primary = (page: Page) => page.evaluate(() => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control'));

test('C then V pastes the picked node with no connections; Shift+V with its connections', async ({ page }) => {
  const mod = await primary(page);
  await header(page, 'Sort').click();
  await page.keyboard.press(`${mod}+c`);
  await page.keyboard.press(`${mod}+v`);
  await settle(page);
  let now = await flow(page);
  expect(now.nodes.filter((n) => n.kind === 'sort')).toHaveLength(2);
  expect(now.connections).toHaveLength(2);
  await page.keyboard.press(`${mod}+Shift+v`);
  await settle(page);
  now = await flow(page);
  expect(now.nodes.filter((n) => n.kind === 'sort')).toHaveLength(3);
  // The third sort is joined as the first: in from the source, out to the output (which takes one connection, so the output keeps its own).
  const third = now.nodes.filter((n) => n.kind === 'sort')[2]!.id;
  expect(now.connections.filter((r) => r.to.startsWith(third) || r.from.startsWith(third))).toEqual([{ from: 'start/rows', to: third }]);
});

test('Alt and a drag moves a copy and leaves the original', async ({ page }) => {
  const before = await flow(page);
  const box = (await header(page, 'Sort').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.keyboard.down('Alt');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 120, { steps: 6 });
  // Mid-drag: the original has not moved; a ghost of it follows the pointer.
  expect(await page.locator('#cv > sherpa-node[data-heading="Sort"]').first().getAttribute('data-x')).toBe(String(before.nodes[1]!.x));
  await expect(page.locator('#cv > svg.graph-ghost rect')).toHaveCount(1);
  await page.mouse.move(x + 40, y + 200, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await settle(page);
  let now = await flow(page);
  expect(now.nodes).toHaveLength(before.nodes.length + 1);
  expect(now.nodes.find((n) => n.id === 'sort')).toMatchObject({ x: before.nodes[1]!.x, y: before.nodes[1]!.y });
  expect(now.connections).toHaveLength(2);
  const copy = now.nodes.find((n) => n.kind === 'sort' && n.id !== 'sort')!;
  expect(copy.y).toBeGreaterThan(before.nodes[1]!.y + 50);
  await expect(page.locator('#cv > svg.graph-ghost')).toHaveCount(0);
});

test('Alt+Shift and a drag moves a copy that keeps the connections in', async ({ page }) => {
  const box = (await header(page, 'Sort').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 120, { steps: 6 });
  await page.mouse.move(x + 40, y + 200, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
  await settle(page);
  const now = await flow(page);
  expect(now.nodes.filter((n) => n.kind === 'sort')).toHaveLength(2);
  expect(now.connections.filter((r) => r.from === 'start/rows')).toHaveLength(2);
});
