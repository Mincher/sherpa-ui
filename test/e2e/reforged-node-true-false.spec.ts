import { test, expect, type Page } from './harness';

/**
 * Only a Condition draws True and False (Will, TODO 831: "just hide them for now"), and a Source's Rows leave
 * from the Store row that makes them, not from a Rows line of their own (TODO 830). Read by boxes and pixels, and
 * made by the real pointer: the Store row's socket joins a Field; a Condition's True and False join an Output.
 * TRAP T-a-socket-says-its-type
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1400px; block-size: 700px"></sherpa-layout-canvas>');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv')! as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, {
      v: 2, id: 'g',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 40, values: { store: 'users' } }, { id: 'f', kind: 'field', x: 420, y: 40 },
        { id: 'v', kind: 'value', x: 20, y: 420 }, { id: 'm', kind: 'math', x: 420, y: 420 },
        { id: 'c', kind: 'condition', x: 820, y: 40 }, { id: 't', kind: 'time', x: 820, y: 540 },
        { id: 'o', kind: 'output', x: 1160, y: 40 },
      ],
      routes: [],
    } as never, { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { role: { label: 'Role' } } } });
    await window.__settled();
    canvas.zoomTo(1);
    // Down from the stage strip: a Condition's True tab hangs ABOVE its card (TODO 887).
    canvas.panTo(0, 32);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const card = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
type Box = { x: number; y: number; w: number; h: number } | null;
/** A socket's box on the screen: a node's (`side`), or one of its rows'. */
const socket = (page: Page, heading: string, side: string, row?: string): Promise<Box> => card(page, heading).evaluate((el, [s, r]) => {
  const host = (r ? el.querySelector(`sherpa-node-row:has(${r})`) : el) as (HTMLElement & { socketRect(side: string): DOMRect | null }) | null;
  const b = host?.socketRect(s!);
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
}, [side, row] as const);
const middle = (b: NonNullable<Box>): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
const routes = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-routes path[data-from]')].map((p) => `${p.getAttribute('data-from')} → ${p.getAttribute('data-to')}`).sort());
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
/** How many pixels in a box are inked, not the canvas's near-white: what the screen draws there. */
async function inked(page: Page, b: NonNullable<Box>): Promise<number> {
  const shot = await page.screenshot({ clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.min(d[i]!, d[i + 1]!, d[i + 2]!) < 200) n++;
    return n;
  }, shot.toString('base64'));
}
const STORE = '[name="store"]';

test('only a Condition draws True and False: a header socket and a footer; no other node draws either', async ({ page }) => {
  expect(await page.locator('#cv > sherpa-node[data-branches]').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')))).toEqual(['Condition']);
  const c = (await socket(page, 'Condition', 'output'))!;
  const f = (await socket(page, 'Condition', 'false'))!;
  expect([c.w > 0, f.w > 0, f.y > c.y]).toEqual([true, true, true]);
  // The others: a Field and a Math and a Value send from a row; none has a header output or a False.
  for (const heading of ['Source', 'Field', 'Value', 'Math', 'Output']) {
    expect(await socket(page, heading, 'output'), `${heading}: no header output`).toBeNull();
    expect(await socket(page, heading, 'false'), `${heading}: no False`).toBeNull();
  }
  // A Time is a check: one boolean from its header, and no False.
  expect(await socket(page, 'Time', 'output')).not.toBeNull();
  expect(await socket(page, 'Time', 'false')).toBeNull();
  // Pixels: both sockets are drawn, inked inside their boxes.
  expect(await inked(page, c), 'the True socket is drawn').toBeGreaterThan(8);
  expect(await inked(page, f), 'the False socket is drawn').toBeGreaterThan(8);
});

test('a Source\'s Rows leave from its Store row, beside its input socket: no Rows line, the pointer joins a Field there', async ({ page }) => {
  const rows = await card(page, 'Source').locator('sherpa-node-row').evaluateAll((els) => els.map((e) => [e.getAttribute('data-label'), e.getAttribute('data-input-socket'), e.getAttribute('data-output-socket')]));
  // The Store row under "Parameters", then under "Properties" the Count property row: output only (plan 835).
  expect(rows).toEqual([['Parameters', null, null], [null, 'value', 'object'], ['Properties', null, null], ['Count', null, 'value']]);
  const [out, inn] = [(await socket(page, 'Source', 'output', STORE))!, (await socket(page, 'Source', 'input', STORE))!];
  // One row: both sockets on its line, the Rows on its right.
  expect([Math.abs(out.y - inn.y) <= 1, out.x > inn.x]).toEqual([true, true]);
  const row = await card(page, 'Source').locator('sherpa-node-row[data-input-socket]').boundingBox();
  expect(out.y).toBeGreaterThanOrEqual(row!.y);
  expect(out.y + out.h).toBeLessThanOrEqual(row!.y + row!.height + 1);
  expect(await inked(page, out), 'the Rows socket is drawn on the Store row').toBeGreaterThan(8);
  // The pointer: from that socket to the Field's header, then the Field's column on to the Condition.
  await drag(page, middle(out), middle((await socket(page, 'Field', 'input'))!));
  expect(await routes(page)).toEqual(['s/rows → f']);
  // The line starts on the Store row, where the socket is.
  const start = await page.evaluate(() => { const d = document.querySelector('#cv svg.graph-routes path[data-from="s/rows"]')!.getAttribute('d')!; return d.match(/M\s*([-\d.]+)[ ,]+([-\d.]+)/)!.slice(1).map(Number); });
  const box = (await page.locator('#cv').boundingBox())!;
  const panned = await page.locator('#cv').evaluate((c) => (c as unknown as { view: { y: number } }).view.y);
  expect(Math.abs(start[1]! + box.y + panned - middle(out)[1])).toBeLessThan(12);
});

test('a Condition\'s True and False join an Output by the real pointer; no other node has either to drag', async ({ page }) => {
  await drag(page, middle((await socket(page, 'Condition', 'output'))!), middle((await socket(page, 'Output', 'input'))!));
  expect(await routes(page)).toEqual(['c → o']);
  await drag(page, middle((await socket(page, 'Condition', 'false'))!), middle((await socket(page, 'Time', 'input'))!));
  expect(await routes(page)).toEqual(['c → o', 'c/#false → t']);
});
