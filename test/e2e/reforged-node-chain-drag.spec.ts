import { test, expect, type Page } from './harness';

/**
 * CHAIN DRAG and NODE RADII — Will, plan 918. With Enable node chain dragging on (`data-chain-drag`), ⌘ or Ctrl held on
 * a node's drag pulls the nodes it joins, and theirs, each by the drag times 1 / (1 + d / 240), d its way along the
 * connectors in px; or, as `data-chain-falloff` says, 1 / (1 + connectors) (Will, TODO 975). ⌘ or Ctrl and an arrow on
 * its header does too. A ⌘ or Ctrl drag pushes a node it meets away, no nearer
 * than their radii (D2 A); a plain drag pushes none (Will, TODO 974). One Undo puts every node back. Real pointer and keys.
 */
type Flow = { nodes: { id: string; x: number; y: number }[] };
type Ed = { workflow(): Flow; undo(): boolean };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, byHand: true as const, id: 'z',
      nodes: [
        { id: 's', kind: 'source', x: 0, y: 0, heading: 'S', values: { store: 'users' } },
        { id: 't', kind: 'condition', x: 500, y: 0, heading: 'T', values: { type: 'empty' } },
        { id: 'o', kind: 'result', x: 1000, y: 0, heading: 'O' },
      ],
      connections: [{ from: 's/rows', to: 't' }, { from: 't/pass', to: 'o' }],
    };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(0.5);
    canvas.panTo(40, 120);
    // The app's setting, on: a provider writes it; here, by hand.
    for (const node of document.querySelectorAll('#cv > sherpa-node')) node.setAttribute('data-chain-drag', '');
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const primary = (page: Page) => page.evaluate(() => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control'));
const places = (page: Page) => page.evaluate(() => Object.fromEntries((window as never as { ed: Ed }).ed.workflow().nodes.map((n) => [n.id, [n.x, n.y]]))) as Promise<Record<string, [number, number]>>;
const header = async (page: Page, heading: string): Promise<[number, number]> => {
  const b = (await page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).boundingBox())!;
  return [b.x + b.width * 0.5, b.y + 8];
};
async function dragNode(page: Page, heading: string, by: [number, number], key?: string): Promise<void> {
  const [x, y] = await header(page, heading);
  await page.mouse.move(x, y);
  if (key) await page.keyboard.down(key);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (by[0] * i) / 8, y + (by[1] * i) / 8, { steps: 2 });
  await page.mouse.up();
  if (key) await page.keyboard.up(key);
  await settle(page);
}

/** Each node's centre on the plane, as drawn. */
const centres = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('#cv > sherpa-node')].map((n) =>
  [n.dataset['heading']!.toLowerCase(), [Number(n.getAttribute('data-x')) + n.offsetWidth / 2, Number(n.getAttribute('data-y')) + n.offsetHeight / 2]]))) as Promise<Record<string, [number, number]>>;
const apart = (c: Record<string, [number, number]>, a: string, b: string) => Math.hypot(c[b]![0] - c[a]![0], c[b]![1] - c[a]![1]);

test('⌘ or Ctrl on a drag pulls the nodes it joins, and theirs, each less the farther it is along the connectors (TODO 975); one Undo puts all back', async ({ page }) => {
  const key = await primary(page);
  const before = await places(page);
  const c = await centres(page);
  // 150 screen px at 0.5 is 300 on the plane, away from T: T comes along by 1 / (1 + d / 240) of it, the Source by less.
  await dragNode(page, 'O', [150, 0], key);
  const after = await places(page);
  const moved = (id: string) => after[id]![0] - before[id]![0];
  expect(moved('o')).toBeGreaterThan(250);
  const [dt, ds] = [apart(c, 'o', 't'), apart(c, 'o', 't') + apart(c, 't', 's')];
  expect(Math.abs(moved('t') - moved('o') / (1 + dt / 240))).toBeLessThanOrEqual(1);
  expect(Math.abs(moved('s') - moved('o') / (1 + ds / 240))).toBeLessThanOrEqual(1);
  expect(moved('s')).toBeLessThan(moved('t'));
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await places(page)).toEqual(before);
});

test('the app\'s setting says Number of connections: the next node comes half the drag, the one after a third (TODO 975)', async ({ page }) => {
  await page.evaluate(() => { for (const node of document.querySelectorAll('#cv > sherpa-node')) node.setAttribute('data-chain-falloff', 'connections'); });
  const before = await places(page);
  await dragNode(page, 'O', [150, 0], await primary(page));
  const after = await places(page);
  const moved = (id: string) => after[id]![0] - before[id]![0];
  expect(Math.abs(moved('t') - moved('o') / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(moved('s') - moved('o') / 3)).toBeLessThanOrEqual(1);
});

test('a plain drag pulls none; the setting off, ⌘ or Ctrl pulls none either', async ({ page }) => {
  const before = await places(page);
  await dragNode(page, 'O', [150, 0]);
  const plain = await places(page);
  expect([plain['t'], plain['s']]).toEqual([before['t'], before['s']]);
  await page.evaluate(() => { for (const node of document.querySelectorAll('#cv > sherpa-node')) node.removeAttribute('data-chain-drag'); });
  await dragNode(page, 'O', [150, 0], await primary(page));
  const off = await places(page);
  expect([off['t'], off['s']]).toEqual([before['t'], before['s']]);
});

test('a plain drag onto another node pushes none (TODO 974); with ⌘ or Ctrl it pushes it away, no nearer than their radii', async ({ page }) => {
  const radius = (heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).evaluate((n) => Math.max((n as HTMLElement).offsetWidth, (n as HTMLElement).offsetHeight) / 2);
  const before = await places(page);
  // The Source onto T: 500 plane px is 250 on the screen. Plain, only the Source moves; one Undo, and with the key.
  await dragNode(page, 'S', [250, 0]);
  const plain = await places(page);
  expect(plain['s']![0]).toBeGreaterThan(before['s']![0] + 400);
  expect([plain['t'], plain['o']]).toEqual([before['t'], before['o']]);
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  await dragNode(page, 'S', [250, 0], await primary(page));
  const after = await places(page);
  expect(after['s']![0]).toBeGreaterThan(before['s']![0] + 400);
  expect(after['t']![0]).toBeGreaterThan(before['t']![0]);
  const centre = (id: string, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).evaluate((n, [x, y]) => [x! + (n as HTMLElement).offsetWidth / 2, y! + (n as HTMLElement).offsetHeight / 2], after[id]!);
  const [[sx, sy], [tx, ty]] = await Promise.all([centre('s', 'S'), centre('t', 'T')]);
  expect(Math.hypot(tx! - sx!, ty! - sy!)).toBeGreaterThanOrEqual((await radius('S')) + (await radius('T')) - 2);
});

test('⌘ or Ctrl and an arrow on a node\'s header pulls the nodes it joins, as a drag does', async ({ page }) => {
  const before = await places(page);
  await page.locator('#cv > sherpa-node[data-heading="O"] >> .header[role="button"]').focus();
  await page.keyboard.press(`${await primary(page)}+ArrowRight`);
  await settle(page);
  const after = await places(page);
  expect(after['o']![0] - before['o']![0]).toBeGreaterThan(0);
  // Each joined node comes along by its weight: right, less the farther it is.
  expect(after['t']![0]).toBeGreaterThan(before['t']![0]);
  expect(after['s']![0]).toBeGreaterThan(before['s']![0]);
});
